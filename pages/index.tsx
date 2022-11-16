import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import React from 'react';
import MapLoadingHolder from '../components/map-loading-holder';
import MapboxMap from '../components/mapbox-map';
 
const Home: NextPage = () => {
  const [loading, setLoading] = React.useState(true);
  const handleMapLoading = () => setLoading(false);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <Head>
        <title>Aquaberry - Web GIS</title>
        <link rel="icon" href="/LogoTransparent.png" />
      </Head>

      <main className="flex w-full flex-1 flex-col items-center justify-center">
        <div className="app-container">
          <div className="map-wrapper">
            <MapboxMap
              onMapLoaded={handleMapLoading}
            />
         </div>
        {loading && <MapLoadingHolder />}
        </div>
      </main>
      <footer className="sticky bottom-4 z-50 bg-[#E9EBDB] text-[#302B38] 
                        rounded-md shadow-lg w-9/12">
        <a
          className="flex items-center justify-center gap-2 p-1 align-middle"
          href="https://aquaberry.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <Image src="/LogoTransparentName.png" alt="Aqauberry Logo" width={72} height={32} />
        </a>
      </footer>
    </div>
  )
}

export default Home
