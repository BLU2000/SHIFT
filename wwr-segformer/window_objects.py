"""8-connected components of the window mask, using row runs and union-find."""
import numpy as np


def window_rectangles(mask):
    height, width = mask.shape
    parents, stats = [], []

    def root(n):
        while parents[n] != n:
            parents[n] = parents[parents[n]]
            n = parents[n]
        return n

    previous = []
    for y in range(height):
        edges = np.flatnonzero(np.diff(np.pad(mask[y].astype(np.int8), (1, 1))))
        current = []
        cursor = 0
        for x0, x1 in zip(edges[::2], edges[1::2]):
            n = len(parents)
            parents.append(n)
            stats.append([int(x0), y, int(x1), y+1, int(x1-x0)])
            while cursor < len(previous) and previous[cursor][1] < x0:
                cursor += 1
            j = cursor
            while j < len(previous) and previous[j][0] <= x1:
                parents[root(n)] = root(previous[j][2])
                j += 1
            current.append((x0, x1, n))
        previous = current
    groups = {}
    for n, (x0, y0, x1, y1, pixels) in enumerate(stats):
        group = root(n)
        if group not in groups:
            groups[group] = [x0, y0, x1, y1, pixels]
        else:
            old = groups[group]
            groups[group] = [min(old[0], x0), min(old[1], y0), max(old[2], x1), max(old[3], y1), old[4]+pixels]
    return [{'id': f'window-{i+1}', 'box': [x0/width, y0/height, x1/width, y1/height], 'mask_pixels': pixels}
            for i, (x0, y0, x1, y1, pixels) in enumerate(sorted(groups.values(), key=lambda b: (b[1], b[0]))) ]
