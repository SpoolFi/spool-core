module.exports = {
    configureYulOptimizer: true,
    skipFiles: ['external/', 'mocks/', 'utils/'],
    mocha: {
        grep: "@skip-on-coverage",
        invert: true
    }
};
