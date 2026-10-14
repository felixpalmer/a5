const sidebars = {
  examplesSidebar: [
    {
      type: 'doc',
      label: 'Overview',
      id: 'index'
    },
    {
      type: 'category',
      label: 'Visualization',
      items: ['airbnb', 'country-polygons', 'duckdb-playground', 'road-safety']
    },
    {
      type: 'category',
      label: 'Technical',
      items: ['teohedron', 'projection', 'lattice', 'hilbert']
    },
    {
      type: 'category',
      label: 'Inspection',
      items: ['accuracy', 'area', 'cells', 'coverings', 'hierarchy', 'polygons', 'traversal']
    },
    {
      type: 'category',
      label: 'Fun',
      items: ['golf']
    }
  ]
};

module.exports = sidebars;
