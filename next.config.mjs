/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage — vídeos/thumbnails enviados pelos instrutores.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Curso de amostra/seed usa isto para thumbnails de exemplo.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
