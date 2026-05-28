---
title: 算法004-ST表(矩阵中的局部最大值 II)
date: '2026-05-18'
lastmod: '2026-05-18'
tags: ['算法', '中等', '笔记', 'ST表', '数组']
draft: false
summary: '本贴依托于[矩阵中的局部最大值 II](https://leetcode.cn/problems/largest-local-values-in-a-matrix-ii)的题，从一位到二维学习ST表'
authors: ['default']
---

## ST表

ST表用于查询区间最大最小值，对于一维数组在预处理时时间复杂度为O(n*logn)，空间复杂度也是O(n*logn)。

### 原理

对于只需要求区间最大最小值时，可以分两次，一个计算前区域一个计算后区域，并且允许并集，比如说：求[l, r]区间最值时，相当于求[l, k1]和[k2, r]两个区间的最值，其中k1 > k2。所以可以考虑用一个具有一定意义，且容易被计算的区间来表示k1-l或r-k2的值。ST表就是使用2的次方表示。下面从一个一维数组来分析。  
首先，由前面所述，我们可以用一个`st[i][j]`来表示[i, i + 2^j - 1]这个区间的最值。为什么时右边需要-1？因为既然是2的次方，那么从左往右总数也应该是2的倍数，比如说[2, 9]就有[2, 3, 4, 5, 6, 7, 8, 9]共8个。  
接下来，需要构建这个表。由前面可知，`st[i][j]`表示[i, i + 2^j - 1]区间的最值。那么可以将其拆为两个子区间[i, i + 2^(j - 1) - 1]和[i + 2^(j - 1), i + 2^j - 1]，然后通过比较两个区间的最值得到总区间的最值。逐渐分解下去，就可以定位到具体长度为1的值。  
最后是查询。从前面很容易知道，前段[l, k1]可以用`st[l][k]`表示，其中k就是log(k1-l)。那么后段如何计算呢？已知后段长度也应该是k，那么应该用`st[r - (k1 - l)][k]`。

### 代码

下面是简单的求区间最小值的例子

```c++
class SparseTableMin {
public:
    vector<vector<int>> st;
    vector<int> lg; // 初始化一个log以便于计算

    SparseTableMin(vector<int>& a) {
        int n = a.size();

        lg.resize(n + 1);
        for (int i = 2; i <= n; i++) {
            lg[i] = lg[i / 2] + 1;
        }

        int K = lg[n] + 1;
        st.assign(n, vector<int>(K));

        for (int i = 0; i < n; i++) {
            st[i][0] = a[i];
        }

        for (int j = 1; j < K; j++) {
            for (int i = 0; i + (1 << j) <= n; i++) {
                st[i][j] = min(
                    st[i][j - 1],
                    st[i + (1 << (j - 1))][j - 1]
                );
            }
        }
    }

    int queryMin(int l, int r) {
        int k = lg[r - l + 1];

        return min(
            st[l][k],
            st[r - (1 << k) + 1][k]
        );
    }
};
```

## 矩阵中的局部最大值 II

给你一个 n x m 的整数矩阵 matrix ，所有元素均为非负整数。

一个 非零 单元格 (row, col) 会按如下方式检查其附近的单元格：

1.令 x = matrix[row][col] 。  
2.考虑在 (row, col) 的 x 行和 x 列范围内的每个单元格。  
3.忽略矩阵外的单元格。  
4.忽略行距离和列距离都恰好等于 x 的 单元格。

如果单元格 (row, col) 是 非零 的，并且所有考虑的单元格中没有一个值 大于 x ，那么该单元格就是一个 局部最大值 。

返回一个整数，表示 matrix 中 局部最大值 的数量。

1. 示例 1：

输入：`matrix = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,2,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]`

输出： `1`

解释：  
对于非零单元格 (3, 3) ，`x = matrix[3][3] = 2` 。  
高亮的单元格是在 (3, 3) 的 x 行和 x 列范围内被考虑的单元格。  
行距离和列距离都等于 x = 2 的四个单元格被忽略。  
没有一个被考虑的单元格的值大于 2 ，因此 (3, 3) 是一个局部最大值。  
没有其他非零单元格，所以答案是 1 。

2. 示例 2：

输入： `matrix = [[1,2],[3,4]]`

输出： `1`

解释：  
只有值为 4 的单元格是局部最大值。其他每个非零单元格都考虑到了一个具有更大值的单元格。

3. 示例 3：

输入：`matrix = [[1,0,1],[0,1,0],[1,0,1]]`

输出：`5`

解释：  
对于值为 1 的单元格，考虑的单元格是其自身及其在矩阵内的 4 个方向上相邻的单元格。  
这五个值为 1 的单元格中，每一个都只考虑到值为 0 或 1 的单元格，所以这五个单元格都是局部最大值。

4. 示例 4：

输入：`matrix = [[1,1],[1,1]]`

输出：`4`

解释：  
所有单元格都具有相同的值。因此，没有任何一个单元格会考虑到具有更大值的其他单元格，所以所有 4 个单元格都是局部最大值。

> 提示：  
> `1 <= n == matrix.length <= 200`  
> `1 <= m == matrix[i].length <= 200`  
> `0 <= matrix[i][j] <= 200`

### 解题思路

二维最值和一维都差不多，一维用一个二维数组表示，而二维则可以用一个四维数组表示，即：`st[i][j][ki][kj]`来表示从坐上点`[i][j]`到右下点`[i + 2^ki - 1][j + 2^kj - 1]`的矩阵中的最值。  
构建：一维数组可以拆成2组，而二维数组则需要拆成四组，即:`st[i][j][ki][kj]`可以拆成`st[i][j][ki-1][kj-1]`、`st[i][j + 2^(kj - 1)][ki-1][kj-1]`、`st[i + 2^(ki - 1)][j][ki-1][kj-1]`和`st[i + 2^(ki - 1)][j + 2^(kj - 1)][ki-1][kj-1]`。但每次都去比较4个很复杂。可以分两次，首先比较列区间最值，然后比较行区间最值。

### 代码

```c++
int countLocalMaximums(vector<vector<int>>& matrix) {
    int n = matrix.size();
    int m = matrix[0].size();

    // 初始化一个log表供于查询
    vector<int> log(max(n, m) + 1);
    log[1] = 0;

    for (int i = 2; i < log.size(); i++) {
        log[i] = log[i / 2] + 1;
    }

    int kn = log[n] + 1;
    int km = log[m] + 1;

    // 初始化一个st表
    vector st(n, vector(m, vector(kn, vector<int>(km)))); // st[x][y][kx][ky]

    for (int i = 0; i < n; i++) {
        for (int j = 0; j < m; j++) {
            st[i][j][0][0] = matrix[i][j];
        }
    }

    for (int kj = 1; kj < km; kj++) {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j <= m - (1 << kj); j++) {
                st[i][j][0][kj] = max(st[i][j][0][kj - 1], st[i][j + (1 << (kj - 1))][0][kj - 1]);
            }
        }
    }

    for (int ki = 1; ki < kn; ki++) {
        for (int kj = 0; kj < km; kj++) {
            for (int i = 0; i <= n - (1 << ki); i++) {
                for (int j = 0; j <= m - (1 << kj); j++) {
                    st[i][j][ki][kj] = max(st[i][j][ki - 1][kj], st[i + (1 << (ki - 1))][j][ki - 1][kj]);
                }
            }
        }
    }

    // 通过st去求
    auto query = [&](int x, int y, int x1, int y1)->int {
        x = max(x, 0);
        y = max(y, 0);
        x1 = min(x1, n);
        y1 = min(y1, m);
        int logx = log[x1 - x];
        int logy = log[y1 - y];

        return max({
            st[x][y][logx][logy],
            st[x][y1 - (1 << logy)][logx][logy],
            st[x1 - (1 << logx)][y][logx][logy],
            st[x1 - (1 << logx)][y1 - (1 << logy)][logx][logy]
        });
    };

    int ans = 0;
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < m; j++) {
            int x = matrix[i][j];
            if (x > 0 && max(query(i - x, j - x + 1, i + x + 1, j + x), query(i - x + 1, j - x, i + x, j + x + 1)) <= x) ans++;
        }
    }

    return ans;
}
```

但时间复杂度和空间复杂度都是O(n*m*logn\*logm),下一章根据线段树进一步优化
