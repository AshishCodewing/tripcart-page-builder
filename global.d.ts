declare module "*.css?url" {
  const url: string
  export default url
}

declare module "*.css?raw" {
  const source: string
  export default source
}
