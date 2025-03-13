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

window.onresize = function(event) {
    var margin = 32;
    ul.style.width = window.innerWidth - 2 * margin + 'px';
    ul.style.height = window.innerHeight - 2 * margin + 'px';
    resize(ul);
};
window.onresize();
