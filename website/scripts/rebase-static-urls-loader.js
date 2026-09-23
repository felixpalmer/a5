// Webpack loader: rewrite root-absolute static asset URLs in the website examples
// to the site's baseUrl, e.g. '/data/x.parquet' -> '/next/data/x.parquet'.
//
// The examples are plain React apps with no Docusaurus imports, so they address
// the site's static files from the root — correct on a5geo.org, but not when the
// same site is served under a base path (the /next preview, or a staging build),
// where the request would fall through to whatever the production site has there.
// Rewriting the literal at build time also means the URL is already right when it
// is handed off to a worker, as the DuckDB example does.
//
// Configured in docusaurus.config.js; not applied at all when baseUrl is '/'.
const STATIC_URL = /(['"`])\/((?:data|images|textures)\/)/g;

// `import x from '/images/y.png'` is resolved by webpack against the static
// directory, so it must keep its original path.
const IMPORT = /^\s*(?:import|export)\s|\brequire\s*\(/;

module.exports = function rebaseStaticUrls(source) {
  const {baseUrl} = this.getOptions();
  return source
    .split('\n')
    .map(line => (IMPORT.test(line) ? line : line.replace(STATIC_URL, `$1${baseUrl}$2`)))
    .join('\n');
};
