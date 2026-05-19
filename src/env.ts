// Detect whether this build is running from a local dev checkout vs an npm install.
// import.meta.url is a file:// URL with forward slashes on all platforms.
// npm installs always land under node_modules; local checkouts never do.
export const IS_LOCAL_DEV = !import.meta.url.includes("/node_modules/");
export const CONTEXT_LABEL = IS_LOCAL_DEV ? "[CAPS Context — LOCAL DEV]" : "[CAPS Context]";
