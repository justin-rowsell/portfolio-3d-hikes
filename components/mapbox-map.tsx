import * as React from "react";
import mapboxgl, { MapboxGeoJSONFeature } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxMapProps {
    initialOptions?: Omit<mapboxgl.MapboxOptions, "container">;
    onMapCreated?(map: mapboxgl.Map): void;
    onMapLoaded?(map: mapboxgl.Map): void;
}

function flattenCoords(coords: number[][][]): number[][] {
    const finalCoords = [];
    for (const stackedList of coords) {
        finalCoords.push(stackedList[0]);
        const length = stackedList.length; 
        if (length > 1) {
            let index = 1;
            while (index < length - 1) {
                finalCoords.push(stackedList[index]);
                index++;
            }
        }
    } 
    return finalCoords;
}

let graphic: number[][] | undefined = undefined;
let id = -1;
function flyToRoute(route: any, map: mapboxgl.Map | undefined) {
    if (id != -1) {
        window.clearInterval(id);
    }
    if (map === undefined) return;
    let targetRoute: number[][] = [];
    if (route.geometry.type == 'MultiLineString')
        targetRoute = flattenCoords(route.geometry.coordinates);
    else
        targetRoute = route.geometry.coordinates;
    graphic = targetRoute;
    map.flyTo({
        center:[targetRoute[0][0], targetRoute[0][1]],
        essential: true
    });
    id = window.setInterval(flashLine, 1000);
    window.setTimeout(() => {
        window.clearInterval(id);
        id = -1;
        clearLayer(map, routeLayerName);
    }, 7000)
}

function getRouteTitle(route: any) {
    return route.properties.route_long;
}
let showLine = true;
const routeLayerName = 'route'
function flashLine() {
    if (graphic == undefined || mapRef == undefined) return;
    if (showLine) {
        mapRef.addSource(routeLayerName, {
            'type': 'geojson',
            'data': {
            'type': 'Feature',
            'properties': {},
            'geometry': {
            'type': 'LineString',
            'coordinates': graphic
            }
        }});
        mapRef.addLayer({
            'id': routeLayerName,
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#C61230',
                'line-width': 8
            }
        });
    }
    else {
        clearLayer(mapRef, routeLayerName);
    }
    showLine = !showLine;
}

function clearLayer(map: mapboxgl.Map, layerName: string) {
    try {
        map.removeLayer(layerName);
        map.removeSource(layerName);
    } catch {}
   
}

let mapRef: mapboxgl.Map | undefined = undefined;
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
            bearing: 0,
          ...initialOptions,
        });

        setMap(mapboxMap);
        mapRef = mapboxMap;
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
                    'line-width': 1,
                    'line-opacity': 0
                }
            });
            
            mapboxMap.addSource('traffic', {
                type: 'vector',
                url: 'mapbox://mapbox.mapbox-traffic-v1'
            });
            mapboxMap.addLayer({
                id: 'traffic',
                type: 'line',
                source: 'traffic',
                "source-layer": 'traffic',
                paint: {
                    "line-width": 3,
                    "line-color": [
                    "case",
                    [ "==", "low", [ "get", "congestion" ]], 
                    "#aab7ef", 
                    [ "==", "moderate", [ "get", "congestion" ]],
                    "#4264fb",
                    [ "==", "heavy", [ "get", "congestion" ]],
                    "#ee4e8b",
                    [ "==", "severe", [ "get", "congestion" ]],
                    "#b43b71",
                    "#000000"
                    ]
                }
            });
            
            
            mapboxMap.on('sourcedata', (e) => {
                if (e.sourceId === 'bus-routes' && e.isSourceLoaded && routes.length === 0) {
                    const features = mapboxMap.querySourceFeatures('bus-routes',  {
                        sourceLayer: 'bus_routes_nyc_may2020-6pebav'
                    });
                    const addedRoutes: Array<string> = [];
                    const noDuplicates = features.filter(f => {
                        const title = getRouteTitle(f);
                        if (addedRoutes.includes(title)) return false;
                        
                        addedRoutes.push(title);
                        return true;
                    });
                    setRoutes(noDuplicates);
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
                    <th className="p-4">Highlight Routes:</th>
                </tr>
            </thead>
            <tbody className="flex flex-col items-center justify-between overflow-y-scroll w-full"
            style={{height: "50vh"}}>
                {routes.map(function(route, i){
                    return <tr key={i} className="hover:bg-[#fdffed] hover:cursor-pointer" onClick={() => flyToRoute(route, map)}>
                                <td>{getRouteTitle(route)}</td>
                            </tr>
                })}
            </tbody>
        </table>
    </div>
  );
}

export default MapboxMap;