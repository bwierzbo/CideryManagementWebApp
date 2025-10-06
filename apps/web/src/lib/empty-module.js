// Empty module to replace @react-pdf/renderer on server-side
// This prevents "self is not defined" errors during SSR

module.exports = {
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: {
    create: () => ({}),
  },
  pdf: () => ({
    toBlob: async () => new Blob(),
  }),
};
