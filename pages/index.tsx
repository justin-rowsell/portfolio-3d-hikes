import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'

const Home: NextPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <Head>
        <title>Aquaberry - Web GIS</title>
        <link rel="icon" href="/LogoTransparent.png" />
      </Head>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-20 text-center">
        <h1 className="text-6xl font-bold">
          Welcome to{' '}
          <a className="text-blue-600" href="https://nextjs.org">
            Next.js!
          </a>
        </h1>
      </main>

      <footer className="flex h-24 w-full items-center justify-left border-t">
        <a
          className="flex items-center justify-center gap-2"
          href="https://aquaberry.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <Image src="/LogoTransparentName.png" alt="Aqauberry Logo" width={72} height={16} />
        </a>
      </footer>
    </div>
  )
}

export default Home
