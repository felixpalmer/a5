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
      items: ['airbnb', 'country-polygons', 'populated-places', 'road-safety']
    },
    {
      type: 'category',
      label: 'Technical',
      items: ['pentagon', 'teohedron-dodecahedron', 'spherical-polygon', 'lattice', 'hilbert', 'globe']
    },
    {
      type: 'category',
      label: 'Inspection',
      items: ['accuracy', 'area', 'cells', 'compaction', 'hierarchy', 'polygons', 'traversal']
    },
    {
      type: 'category',
      label: 'Fun',
      items: ['golf']
    }
  ]
};

module.exports = sidebars;
