---
title: 算法010-Tarjan(寻找图强链接桥的算法)
date: '2026-08-04'
lastmod: '2026-08-04'
tags: ['算法', '困难', '笔记', 'Tarjan', '并查集', 'Kruskal']
draft: false
summary: '本次学习寻找图中具有强链接性的桥的算法Tarjan。[找到最小生成树里的关键边和伪关键边](https://leetcode.cn/problems/find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree)'
authors: ['default']
---

## Tarjan

将一个图变成最小生成树时，会删去一些边，某些边例如[a->b->c->a]删除任意边都可以变成树，而某些边是不可删除的，这就需要Tarjan算法去得到这些边。

Tarjan的逻辑很简单，利用dfs算法深入所有节点：

如果访问后，没有回到原来的节点，或者他的下一个甚至最里的节点没有到达过比他的深度更小的节点，那么就说明他到下一个节点的边是强链接边，即：`dfn[u] < low[v]`（其中`u`是当前节点，`v`是下一个节点，`dfn[u]`表示当前节点的深度，`low[v]`表示下一个节点所能到达的最浅节点），此时`u->v`的边是强链接边。

相反，如果c遇到已被访问的点a，说明这个点是有多条路（对于有向图来说说明是可以互相到达的，这里主要探讨无向图），那么他们之间某些边就是弱强链接边。即：`dfn[u] >= low[v]`，此时`v`可以有其他路到达`u`，或者比其更浅的节点。

### 代码模版

```c++
#include <bits/stdc++.h>
using namespace std;

class TarjanBridge {
private:
    struct Edge {
        int to;
        int id;
    };

    int n;
    int timer = 0;

    vector<vector<Edge>> graph;
    vector<int> dfn;
    vector<int> low;
    vector<int> bridges;

    void dfs(int u, int parentEdgeId)
    {
        dfn[u] = low[u] = ++timer;

        for (const auto& edge : graph[u]) {
            int v = edge.to;
            int edgeId = edge.id;

            if (dfn[v] == 0) {
                // DFS树边
                dfs(v, edgeId);

                low[u] = min(low[u], low[v]);

                // v的子树无法通过其他边回到u或u的祖先
                if (low[v] > dfn[u]) {
                    bridges.push_back(edgeId);
                }
            } else if (edgeId != parentEdgeId) {
                // 已访问节点，并且不是DFS走来的父边
                low[u] = min(low[u], dfn[v]);
            }
        }
    }

public:
    explicit TarjanBridge(int nodeCount)
        : n(nodeCount),
          graph(nodeCount),
          dfn(nodeCount, 0),
          low(nodeCount, 0)
    {
    }

    void addEdge(int u, int v, int edgeId)
    {
        graph[u].push_back({v, edgeId});
        graph[v].push_back({u, edgeId});
    }

    vector<int> getBridges()
    {
        timer = 0;
        fill(dfn.begin(), dfn.end(), 0);
        fill(low.begin(), low.end(), 0);
        bridges.clear();

        // 图可能不连通
        for (int u = 0; u < n; ++u) {
            if (dfn[u] == 0) {
                dfs(u, -1);
            }
        }

        return bridges;
    }
};
```

其中最关键的代码是：

1. `dfn[u] = low[u] = ++timer;`：用于记录深度，在对于没有访问过的点，就将它深度表示为当前最大深度。
2. `low[u] = min(low[u], low[v]);`：用于记录它所能访问的最小点，因为环具有继承性，下一个能到的最小点，当前点一定能通过下一个点到。
3. `low[v] > dfn[u]`：下一个点能到达的最小点比当前点大，说明当前点到不了比他更小的点，换句话说，他到下一个点具有强链接性。

## 找到最小生成树里的关键边和伪关键边

给你一个 `n` 个点的带权无向连通图，节点编号为 `0` 到 `n-1` ，同时还有一个数组 `edges` ，其中 `edges[i] = [fromi, toi, weighti]` 表示在 `fromi` 和 `toi` 节点之间有一条带权无向边。最小生成树 (MST) 是给定图中边的一个子集，它连接了所有节点且没有环，而且这些边的权值和最小。

请你找到给定图中最小生成树的所有关键边和伪关键边。如果从图中删去某条边，会导致最小生成树的权值和增加，那么我们就说它是一条关键边。伪关键边则是可能会出现在某些最小生成树中但不会出现在所有最小生成树中的边。

请注意，你可以分别以任意顺序返回关键边的下标和伪关键边的下标。

1. 示例 1：

输入：  
`n = 5, edges = [[0,1,1],[1,2,1],[2,3,2],[0,3,2],[0,4,3],[3,4,3],[1,4,6]]`

输出：  
`[[0,1],[2,3,4,5]]`

解释：  
上图描述了给定图。

注意到第 0 条边和第 1 条边出现在了所有最小生成树中，所以它们是关键边，我们将这两个下标作为输出的第一个列表。  
边 2，3，4 和 5 是所有 MST 的剩余边，所以它们是伪关键边。我们将它们作为输出的第二个列表。

2. 示例 2 ：

输入：  
`n = 4, edges = [[0,1,1],[1,2,1],[2,3,1],[0,3,1]]`

输出：  
`[[],[0,1,2,3]]`

解释：  
可以观察到 4 条边都有相同的权值，任选它们中的 3 条可以形成一棵 MST 。所以 4 条边都是伪关键边。

> 提示：  
> `2 <= n <= 100`  
> `1 <= edges.length <= min(200, n * (n - 1) / 2)`  
> `edges[i].length == 3`  
> `0 <= fromi < toi < n`  
> `1 <= weighti <= 1000`  
> `所有 (fromi, toi) 数对都是互不相同的。`

### 题解

最简单的算法是直接通过Kruskal多轮去寻找最小边，来判断是不是强连通边。

由于我们通过先对其排序，在使用并查集将点用最小边链接在一起，这也是Kruskal的核心算法。

但是简单通过Kruskal算法时间复杂度十分大，大于有`O(m²α(m))`。

Tarjan算法可以在处理某个权值 w 时：将比 w 小的边已经通过并查集形成若干连通分量。并把每个连通分量缩成一个点。然后用当前权值为 w 的边建立临时图。例如：`A ══ B ── C`，其中：A-B 有两条同权边，可以互相替代；B-C 只有一条边，没有替代路线。

这时就转化成了一个标准问题：临时图中，删除哪条边会导致图断开？这正是 Tarjan 求桥解决的问题。  
桥边：删除后图断开，说明没有其他同权路线替代，所以所有最小生成树都必须选，是关键边。  
非桥边：删除后仍连通，说明存在同权替代路线，可以选也可以不选，是伪关键边。

### 代码

```c++
class UFind {
    vector<int> father;
    vector<int> deep;

public:
    UFind(int n) {
        father.resize(n);
        iota(father.begin(), father.end(), 0);
        deep.resize(n);
    }

    int find(int x) {
        if (father[x] != x) {
            father[x] = find(father[x]);
        }
        return father[x];
    }

    void unite(int x, int y) {
        int rootx = find(x);
        int rooty = find(y);

        if (rootx != rooty) {
            if (deep[rootx] > deep[rooty]) {
                father[rooty] = rootx;
            } else if (deep[rootx] < deep[rooty]) {
                father[rootx] = rooty;
            } else {
                father[rooty] = rootx;
                deep[rootx]++;
            }
        }
    }
};

class Tarjan {
    unordered_map<int, int> dfn;
    unordered_map<int, int> low;
    vector<int> ans;
    int tm;

    void getEdges_(int u, int id, unordered_map<int,vector<pair<int, int>>> &gm) {
        low[u] = dfn[u] = ++tm;
        for (auto &[v, no] : gm[u]) {
            if (!dfn.count(v)) {
                getEdges_(v, no, gm);
                low[u] = min(low[v], low[u]);
                if (low[v] > dfn[u]) ans.push_back(no);
            } else if (id != no) {
                low[u] = min(low[u], dfn[v]);
            }
        }

    }

public:
    Tarjan():tm(0) {}

    vector<int> getEdges(unordered_map<int,vector<pair<int, int>>> &gm) {
        for (auto &[x, _] : gm) {
            if (!dfn.count(x)) {
                getEdges_(x, -1, gm);
            }
        }

        return ans;
    }
};

class Solution {
public:
    vector<vector<int>> findCriticalAndPseudoCriticalEdges(int n, vector<vector<int>>& edges) {
        int m = edges.size();
        for (int i = 0; i < m; i++) {
            edges[i].push_back(i);
        }
        sort(edges.begin(), edges.end(), [](const auto &a, const auto &b){return a[2] < b[2];});

        UFind uf(n);
        vector<int> vis(m); // 记录是否关键边
        vector<vector<int>> ans(2);

        for (int i = 0; i < m;) {
            int j = i;
            int w = edges[i][2];
            while (j < m && edges[j][2] == w) j++;

            UFind uf_tmp = uf;
            unordered_map<int,vector<pair<int, int>>> gm; // 边集合，将uf原有的点集默认为父号点集合，其他为对应点，除此之外，还要包含边序列号，因为返回答案就是序列号

            for (int k = i; k < j; k++) {
                int a = edges[k][0], b = edges[k][1], no = edges[k][3];
                int roota = uf.find(a), rootb = uf.find(b);
                if (roota != rootb) {
                    uf_tmp.unite(a, b);
                    gm[roota].emplace_back(rootb, no);
                    gm[rootb].emplace_back(roota, no);
                    vis[no] = 1;
                }
            }

            // 然后开始求关键边
            auto bridges = Tarjan().getEdges(gm);

            for (auto b : bridges) {
                ans[0].push_back(b);
                vis[b] = 0;
            }

            i = j;
            uf = uf_tmp;
        }

        for (int i = 0; i < m; i++) {
            if (vis[i]) ans[1].push_back(i);
        }

        sort(ans[0].begin(), ans[0].end());
        sort(ans[1].begin(), ans[1].end());

        return ans;
    }
};
```
