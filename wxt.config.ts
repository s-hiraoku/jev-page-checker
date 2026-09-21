import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Jev Audit",
    version: "0.0.1",
    description: "Audit the publisher and body of the current page with an approved Jev checklist",
    homepage_url: "https://github.com/s-hiraoku/jev-page-checker",
    permissions: ["sidePanel", "storage", "tabs"],
    host_permissions: ["http://*/*", "https://*/*", "https://api.typesafe.ai/*"],
    options_ui: {
      open_in_tab: true,
    },
    action: {
      default_title: "Audit this tab",
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        128: "icon-128.png",
      },
    },
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
  },
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      if (manifest.options_ui) manifest.options_ui.open_in_tab = true;
    },
  },
});
