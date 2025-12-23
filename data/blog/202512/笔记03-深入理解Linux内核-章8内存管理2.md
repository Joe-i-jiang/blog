---
title: 笔记03-深入理解Linux内核-章8内存管理2
date: '2025-12-22'
lastmod: '2025-12-22'
tags: ['深入理解Linux内核', 'Linux内核', '笔记', '内存']
draft: false
summary: '阅读深入理解linux内核，第八章，笔记。'
authors: ['default']
---

## 内存区管理

### slab分配器

伙伴系统是对页的分配，而对于更小的内存，则是用了slab。数据结构如下：

```c
struct slab {
	struct list_head	list;
	unsigned long		colouroff;     /* slab中第一个对象的着色 */
        /* slab中第一个对象(已分配或空闲)的地址 */
	void			*s_mem;		/* including colour offset */
        /* 当前正在使用的slab中的对象个数 */
	unsigned int		inuse;		/* num of objs active in slab */
        /* slab中下一个空闲对象的下标，如果没有剩下空闲对象则为BUFCTL_END */
	kmem_bufctl_t		free;
};

/*
 * kmem_cache_t
 *
 * manages a cache.
 */
struct kmem_cache_s {
/* 1) per-cpu data, touched during every alloc/free */
	struct array_cache	*array[NR_CPUS];
	unsigned int		batchcount;
	unsigned int		limit;
/* 2) touched by every alloc & free from the backend */
	struct kmem_list3	lists;
	/* NUMA: kmem_3list_t	*nodelists[MAX_NUMNODES] */
        /* 高速缓存中对齐后对象的大小 */
	unsigned int		objsize;
	unsigned int	 	flags;	/* constant flags */
        /* 封装在一个单独slab中的对象个数(高速缓存中所有的slab都具有相同大小 */
	unsigned int		num;	/* # of objs per slab */
        /* 整个slab高速缓存中空闲对象的上限 */
	unsigned int		free_limit; /* upper limit of objects in the lists */
        /* 高速缓存的自旋锁 */
	spinlock_t		spinlock;

/* 3) cache_grow/shrink */
	/* order of pgs per slab (2^n) */
        /* 一个单独的slab中包含的连续页框数目的对数 */
	unsigned int		gfporder;

	/* force GFP flags, e.g. GFP_DMA */
        /* 分配页框时传递给伙伴系统函数的一组标记 */
	unsigned int		gfpflags;

        /* slab中使用颜色的个数 */
	size_t			colour;		/* cache colouring range */
	unsigned int		colour_off;	/* colour offset */
	unsigned int		colour_next;	/* cache colouring */
	kmem_cache_t		*slabp_cache;
        /* 单个slab的大小 */
	unsigned int		slab_size;
	unsigned int		dflags;		/* dynamic flags */

	/* constructor func */
        /* 指向与高速缓存相关的构造方法的指针 */
	void (*ctor)(void *, kmem_cache_t *, unsigned long);

	/* de-constructor func */
        /* 指向与高速缓存相关的析构方法的指针 */
	void (*dtor)(void *, kmem_cache_t *, unsigned long);

/* 4) cache creation/removal */
	const char		*name;            /* 高速缓存的名称 */
	struct list_head	next;              /* 高速缓存双向链表 */

/* 5) statistics */
#if STATS
	unsigned long		num_active;
	unsigned long		num_allocations;
	unsigned long		high_mark;
	unsigned long		grown;
	unsigned long		reaped;
	unsigned long 		errors;
	unsigned long		max_freeable;
	unsigned long		node_allocs;
	atomic_t		allochit;
	atomic_t		allocmiss;
	atomic_t		freehit;
	atomic_t		freemiss;
#endif
#if DEBUG
	int			dbghead;
	int			reallen;       /* 对象的实际大小 */
#endif
};
```

> 但由于实际太繁琐，等等已被废除，现在位slub，包括后面内容都是对最新内核slub讲述，并结构与原文不同。

### slub

#### 数据结构

1. 基本单位依然是slab，相当于一个容器。而freelist表示当前空闲的内存。

```c
struct slab {
	unsigned long flags;

	struct kmem_cache *slab_cache;
	union {
		struct {
			union {
				struct list_head slab_list;
#ifdef CONFIG_SLUB_CPU_PARTIAL
				struct {
					struct slab *next;
					int slabs;	/* Nr of slabs left */
				};
#endif
			};
			/* Double-word boundary */
			union {
				struct {
					void *freelist;		/* first free object */
					union {
						unsigned long counters;
						struct {
							unsigned inuse:16;
							unsigned objects:15;
							/*
							 * If slab debugging is enabled then the
							 * frozen bit can be reused to indicate
							 * that the slab was corrupted
							 */
							unsigned frozen:1;
						};
					};
				};
#ifdef system_has_freelist_aba
				freelist_aba_t freelist_counter;
#endif
			};
		};
		struct rcu_head rcu_head;
	};

	unsigned int __page_type;
	atomic_t __page_refcount;
#ifdef CONFIG_SLAB_OBJ_EXT
	unsigned long obj_exts;
#endif
};
```

2. kmem_cache_cpu是cpu对这个容器的操作通道。它最特别之处在于slab变量是指向唯一的活跃的slab，而partial指向未被用满的slab。

```c
/*
 * When changing the layout, make sure freelist and tid are still compatible
 * with this_cpu_cmpxchg_double() alignment requirements.
 */
struct kmem_cache_cpu {
	union {
		struct {
            // 指向当前的slab的第一个空闲容器
			void **freelist;	/* Pointer to next available object */
            // 固定的id号
			unsigned long tid;	/* Globally unique transaction id */
		};
		freelist_aba_t freelist_tid;
	};
    // 第一个活跃的slab
	struct slab *slab;	/* The slab from which we are allocating */
#ifdef CONFIG_SLUB_CPU_PARTIAL
	struct slab *partial;	/* Partially allocated slabs */
#endif
	local_lock_t lock;	/* Protects the fields above */
#ifdef CONFIG_SLUB_STATS
	unsigned int stat[NR_SLUB_STAT_ITEMS];
#endif
};
```
