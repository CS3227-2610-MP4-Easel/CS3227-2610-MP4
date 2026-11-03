import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.js'],
    };
    return webpackConfig;
  },
};
export default config;
