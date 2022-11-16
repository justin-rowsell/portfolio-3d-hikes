import * as React from "react";
import mapboxgl, { MapboxGeoJSONFeature } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from '@turf/turf'

interface MapboxMapProps {
    initialOptions?: Omit<mapboxgl.MapboxOptions, "container">;
    onMapCreated?(map: mapboxgl.Map): void;
    onMapLoaded?(map: mapboxgl.Map): void;
}

function transformCameraRoute(pitch: number, bearing: number, targetPosition: number[], altitude: number, smooth: boolean=false) {
    var bearingInRadian = bearing / 57.29;
    var pitchInRadian = (90 - pitch) / 57.29;
        
    var lngDiff =
      ((altitude / Math.tan(pitchInRadian)) *
        Math.sin(-bearingInRadian)) /
      70000; // ~70km/degree longitude
    var latDiff =
      ((altitude / Math.tan(pitchInRadian)) *
        Math.cos(-bearingInRadian)) /
      110000 // 110km/degree latitude
    
    var correctedLng = targetPosition[0] + lngDiff;
    var correctedLat = targetPosition[1] - latDiff;
    
    return [ correctedLng, correctedLat ]
}

function animateRoute(route: any, map: mapboxgl.Map | undefined) {
    // const targetRoute = flattenCoords(route.geometry.coordinates);
    const flattenedTargetRoute = turf.flatten(route.geometry);
    console.log(flattenedTargetRoute);
    const targetRouteCoords = flattenedTargetRoute.features[0].geometry.coordinates as any;

    const animationDuration = 80000;
    const cameraAltitude = 4000;

    // get the overall distance of each route so we can interpolate along them
    const routeDistance = turf.lineDistance(turf.lineString(targetRouteCoords));
    // const cameraRoute = route.geometry.coordinates.map((coord: number[]) => {
    //     return transformCameraRoute(70, 0, coord, 3000000, true);
    // });
    const cameraRoute = targetRouteCoords;
    console.log(route.geometry.coordinates);
    console.log(cameraRoute);

    const cameraRouteDistance = turf.lineDistance(turf.lineString(cameraRoute));
 
    let start: number;
 
    function frame(time: number) {
        if (!start) start = time;
        // phase determines how far through the animation we are
        const phase = (time - start) / animationDuration;
 
        // phase is normalized between 0 and 1
        // when the animation is finished, reset start to loop the animation
        // if (phase > 1) {
        //     // wait 1.5 seconds before looping
        //     setTimeout(() => {
        //         start = 0.0;
        //     }, 1500);
        // }

        // use the phase to get a point that is the appropriate distance along the route
        // this approach syncs the camera and route positions ensuring they move
        // at roughly equal rates even if they don't contain the same number of points
        const alongRoute = turf.along(turf.lineString(targetRouteCoords), routeDistance * phase).geometry.coordinates;
        
        const alongCamera = turf.along(
            turf.lineString(cameraRoute),
            cameraRouteDistance * phase
        ).geometry.coordinates;

        if (map == undefined) return;
        const camera = map.getFreeCameraOptions();
        
        // set the position and altitude of the camera
        camera.position = mapboxgl.MercatorCoordinate.fromLngLat({
            lng: alongCamera[0],
            lat: alongCamera[1]
        }, cameraAltitude);

        // tell the camera to look at a point along the route
        camera.lookAtPoint({
            lng: alongRoute[0],
            lat: alongRoute[1]
        });

        map.setFreeCameraOptions(camera);
        window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
}

function getRouteTitle(route: any) {
    return route.properties.route_long;
}

function MapboxMap({ initialOptions = {}, onMapCreated, onMapLoaded }: MapboxMapProps) {
    const [map, setMap] = React.useState<mapboxgl.Map>();
    const [routes, setRoutes] = React.useState<MapboxGeoJSONFeature[]>([]);

    const mapNode = React.useRef(null);

    React.useEffect(() => {
        const node = mapNode.current;

        if (typeof window === "undefined" || node === null) return;
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_PORTFOLIO_MAPBOX_TOKEN as string;
        const mapboxMap = new mapboxgl.Map({
          container: node,
          style: 'mapbox://styles/mapbox/light-v10',
            center: [-74.0066, 40.7135],
            zoom: 15.5,
            pitch: 65,
            bearing: -180,
          ...initialOptions,
        });

        setMap(mapboxMap);
        if (onMapCreated) onMapCreated(mapboxMap);
    
        if (onMapLoaded) mapboxMap.once("load", onMapLoaded);
        
        mapboxMap.on('load', () => {
            // Insert the layer beneath any symbol layer.
            const layers = mapboxMap.getStyle().layers;
            if (layers === undefined) return;

            const layer = layers.find((l) => {
                return l.type === 'symbol' && l.layout && l.layout['text-field'];
            });
            const labelLayerId = layer?.id;

            // The 'building' layer in the Mapbox Streets
            // vector tileset contains building height data
            // from OpenStreetMap.
            mapboxMap.addLayer(
            {
                'id': 'add-3d-buildings',
                'source': 'composite',
                'source-layer': 'building',
                'filter': ['==', 'extrude', 'true'],
                'type': 'fill-extrusion',
                'minzoom': 15,
                'paint': {
                    'fill-extrusion-color': '#aaa',
                
                    // Use an 'interpolate' expression to
                    // add a smooth transition effect to
                    // the buildings as the user zooms in.
                    'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.6
                }
            }, labelLayerId);

            mapboxMap.addSource('bus-routes', {
                type: 'vector',
                url: 'mapbox://aquaberry-dev.dvgwbvi6'
            });
            mapboxMap.addLayer({
                id: 'bus-routes',
                type: 'line',
                source: 'bus-routes',
                "source-layer": 'bus_routes_nyc_may2020-6pebav',
                paint: {
                    'line-color': '#BD2B3A',
                    'line-width': 1
                }
            });
            
            
            mapboxMap.on('sourcedata', (e) => {
                if (e.sourceId === 'bus-routes' && e.isSourceLoaded && routes.length === 0) {
                    const features = mapboxMap.querySourceFeatures('bus-routes',  {
                        sourceLayer: 'bus_routes_nyc_may2020-6pebav'
                    });
                    setRoutes(features);
                }
            });
        });
    }, []);

    return (
    <div className="container" style={{ width: "100%", height: "100%" }}>
        <div ref={mapNode} style={{ width: "100%", height: "100%" }} />
        <table className="top-0 right-0 absolute rounded-md shadow-lg w-3/12 text-center m-1
        bg-[#E9EBDB] text-[#302B38] opactiy-20">
            <thead className="text-left flex w-full">
                <tr className="flex w-full mb-4">
                    <th className="p-4">Animate Routes:</th>
                </tr>
            </thead>
            <tbody className="flex flex-col items-center justify-between overflow-y-scroll w-full"
            style={{height: "50vh"}}>
                {routes.map(function(route, i){
                    return <tr key={i} className="hover:bg-[#fdffed]" onClick={() => animateRoute(route, map)}>
                                <td>{getRouteTitle(route)}</td>
                            </tr>
                })}
            </tbody>
        </table>
    </div>
  );
}

export default MapboxMap;