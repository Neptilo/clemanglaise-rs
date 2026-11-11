function resize(node) {
    var w = node.clientWidth;
    var h = node.clientHeight;
    var n = node.children.length;
    if (n != 0) {
        // Compute number of rows and columns, and cell size
        var ratio = w / h;
        var ncols_float = Math.sqrt(n * ratio);
        var nrows_float = n / ncols_float;

        // Find best option filling the whole height
        var nrows1 = Math.ceil(nrows_float);
        var ncols1 = Math.ceil(n / nrows1);
        while (nrows1 * ratio < ncols1) {
            nrows1++;
            ncols1 = Math.ceil(n / nrows1);
        }
        var cell_size1 = h / nrows1;

        // Find best option filling the whole width
        var ncols2 = Math.ceil(ncols_float);
        var nrows2 = Math.ceil(n / ncols2);
        while (ncols2 < nrows2 * ratio) {
            ncols2++;
            nrows2 = Math.ceil(n / ncols2);
        }
        var cell_size2 = w / ncols2;

        // Find the best values
        var nrows, ncols, cell_size;
        if (cell_size1 < cell_size2) {
            nrows = nrows2;
            ncols = ncols2;
            cell_size = cell_size2;
        } else {
            nrows = nrows1;
            ncols = ncols1;
            cell_size = cell_size1;
        }

        // Apply geometry properties
        var actual_width = ncols * cell_size;
        var actual_height = nrows * cell_size;
        var offset = [(w - actual_width) / 2, (h - actual_height) / 2];
        for (var j = 0; j < n; j++) {
            var kid = node.children[j];
            kid.style.left = offset[0] + cell_size * (j % ncols) + 'px';
            kid.style.top = offset[1] + cell_size * Math.floor(j / ncols) + 'px';
            kid.style.width = cell_size + 'px';
            kid.style.height = cell_size + 'px';
        }
    }
}

var ul = document.getElementsByTagName('ul')[0];

// The grid is absolutely positioned, so it does not take part in the page
// flow: its height must be the space left under whatever the page shows above
// it (a heading, the online/offline switch), not the whole viewport.
function fitToViewport() {
    var margin = 32;
    var bodyStyle = getComputedStyle(document.body);
    var contentWidth =
        document.body.clientWidth -
        parseFloat(bodyStyle.paddingLeft) -
        parseFloat(bodyStyle.paddingRight);
    ul.style.width = contentWidth - 2 * margin + 'px';
    // The page also ends with the body's bottom padding, so the grid may only
    // claim what is left once that padding and the margin are accounted for.
    var top = ul.getBoundingClientRect().top + window.scrollY;
    var available =
        window.innerHeight -
        top -
        parseFloat(bodyStyle.paddingBottom) -
        margin;
    ul.style.height = Math.max(available, 0) + 'px';
    resize(ul);
}

window.onresize = fitToViewport;
fitToViewport();
