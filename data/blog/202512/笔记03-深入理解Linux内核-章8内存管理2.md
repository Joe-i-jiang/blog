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

#### 分配

如上所述，slub在分配时候，会先定位cpu，再定位对应的活跃slab。

1. **slab_alloc_node是slab分配的入口，首先会判断活跃的slab中有没有空位，有就会get_freepointer_safe进入快分配，没有就会**slab_alloc慢分配。

```c
static __always_inline void *__slab_alloc_node(struct kmem_cache *s,
		gfp_t gfpflags, int node, unsigned long addr, size_t orig_size)
{
	struct kmem_cache_cpu *c;
	struct slab *slab;
	unsigned long tid;
	void *object;

redo:
	c = raw_cpu_ptr(s->cpu_slab);
	tid = READ_ONCE(c->tid);

	barrier();

	object = c->freelist;	//活跃slab中的空闲链表
	slab = c->slab;			//活跃slab

#ifdef CONFIG_NUMA
	//... ...
#endif

	if (!USE_LOCKLESS_FAST_PATH() ||
	    unlikely(!object || !slab || !node_match(slab, node))) {
		object = __slab_alloc(s, gfpflags, node, addr, c, orig_size);
	} else {
		void *next_object = get_freepointer_safe(s, object);

		if (unlikely(!__update_cpu_freelist_fast(s, object, next_object, tid))) { //这个是判断当前分配中是否被其他干扰，导致活跃slab等变了
			note_cmpxchg_failure("slab_alloc", s, tid);
			goto redo;
		}
		prefetch_freepointer(s, next_object);
		stat(s, ALLOC_FASTPATH);
	}

	return object;
}
```

2. **slab*alloc -> ***slab_alloc，实际在这里分配，但源代码流程很复杂，下边做了一些简化，一些功能，文字带过：

```c
static void *___slab_alloc(struct kmem_cache *s, gfp_t gfpflags, int node,
			  unsigned long addr, struct kmem_cache_cpu *c, unsigned int orig_size)
{
	void *freelist;
	struct slab *slab;
	unsigned long flags;
	struct partial_context pc;
	bool try_thisnode = true;

	stat(s, ALLOC_SLOWPATH);

reread_slab:

	slab = READ_ONCE(c->slab);
	if (!slab) {
		//如果活跃slab无空闲则跳new_slab分配
		if (unlikely(node != NUMA_NO_NODE &&
			     !node_isset(node, slab_nodes)))
			node = NUMA_NO_NODE;
		goto new_slab;
	}

	// 活跃有空闲，则检查并分配
	if (unlikely(!node_match(slab, node))) {
		//...
	}

	if (unlikely(!pfmemalloc_match(slab, gfpflags)))
		goto deactivate_slab;

	/* must check again c->slab in case we got preempted and it changed */
	local_lock_irqsave(&s->cpu_slab->lock, flags);
	if (unlikely(slab != c->slab)) {
		local_unlock_irqrestore(&s->cpu_slab->lock, flags);
		goto reread_slab;
	}
	freelist = c->freelist;
	if (freelist)
		goto load_freelist;

	freelist = get_freelist(s, slab);

	if (!freelist) {
		c->slab = NULL;
		c->tid = next_tid(c->tid);
		local_unlock_irqrestore(&s->cpu_slab->lock, flags);
		stat(s, DEACTIVATE_BYPASS);
		goto new_slab;
	}

	stat(s, ALLOC_REFILL);

load_freelist: //最终都在这里分配

	lockdep_assert_held(this_cpu_ptr(&s->cpu_slab->lock));

	/*
	 * freelist is pointing to the list of objects to be used.
	 * slab is pointing to the slab from which the objects are obtained.
	 * That slab must be frozen for per cpu allocations to work.
	 */
	VM_BUG_ON(!c->slab->frozen);
	c->freelist = get_freepointer(s, freelist);
	c->tid = next_tid(c->tid);
	local_unlock_irqrestore(&s->cpu_slab->lock, flags);
	return freelist;

deactivate_slab: //检查不通过则将活跃slab卸下来放到全局中

	local_lock_irqsave(&s->cpu_slab->lock, flags);
	if (slab != c->slab) {
		local_unlock_irqrestore(&s->cpu_slab->lock, flags);
		goto reread_slab;
	}
	freelist = c->freelist;
	c->slab = NULL;
	c->freelist = NULL;
	c->tid = next_tid(c->tid);
	local_unlock_irqrestore(&s->cpu_slab->lock, flags);
	deactivate_slab(s, slab, freelist);

new_slab: //首先尝试在当前空闲链表中找位置

#ifdef CONFIG_SLUB_CPU_PARTIAL
	while (slub_percpu_partial(c)) {
		local_lock_irqsave(&s->cpu_slab->lock, flags);
		if (unlikely(c->slab)) {
			local_unlock_irqrestore(&s->cpu_slab->lock, flags);
			goto reread_slab;
		}
		if (unlikely(!slub_percpu_partial(c))) {
			local_unlock_irqrestore(&s->cpu_slab->lock, flags);
			/* we were preempted and partial list got empty */
			goto new_objects;
		}

		slab = slub_percpu_partial(c);
		slub_set_percpu_partial(c, slab);

		if (likely(node_match(slab, node) &&
			   pfmemalloc_match(slab, gfpflags))) {
			c->slab = slab;
			freelist = get_freelist(s, slab);
			VM_BUG_ON(!freelist);
			stat(s, CPU_PARTIAL_ALLOC);
			goto load_freelist;
		}

		local_unlock_irqrestore(&s->cpu_slab->lock, flags);

		slab->next = NULL;
		__put_partials(s, slab);
	}
#endif

new_objects: //没位置到全局中找

	pc.flags = gfpflags;

	if (unlikely(node != NUMA_NO_NODE && !(gfpflags & __GFP_THISNODE)
		     && try_thisnode))
		pc.flags = GFP_NOWAIT | __GFP_THISNODE;

	pc.orig_size = orig_size;
	slab = get_partial(s, node, &pc);
	if (slab) {
		if (kmem_cache_debug(s)) {
			freelist = pc.object;

			if (s->flags & SLAB_STORE_USER)
				set_track(s, freelist, TRACK_ALLOC, addr,
					  gfpflags & ~(__GFP_DIRECT_RECLAIM));

			return freelist;
		}

		freelist = freeze_slab(s, slab);
		goto retry_load_slab;
	}

	slub_put_cpu_ptr(s->cpu_slab);
	slab = new_slab(s, pc.flags, node); //再没位置只有重新分配
	c = slub_get_cpu_ptr(s->cpu_slab);

	if (unlikely(!slab)) {
		if (node != NUMA_NO_NODE && !(gfpflags & __GFP_THISNODE)
		    && try_thisnode) {
			try_thisnode = false;
			goto new_objects;
		}
		slab_out_of_memory(s, gfpflags, node);
		return NULL;
	}

	stat(s, ALLOC_SLAB);

	if (kmem_cache_debug(s)) {
		freelist = alloc_single_from_new_slab(s, slab, orig_size);

		if (unlikely(!freelist))
			goto new_objects;

		if (s->flags & SLAB_STORE_USER)
			set_track(s, freelist, TRACK_ALLOC, addr,
				  gfpflags & ~(__GFP_DIRECT_RECLAIM));

		return freelist;
	}

	freelist = slab->freelist;
	slab->freelist = NULL;
	slab->inuse = slab->objects;
	slab->frozen = 1;

	inc_slabs_node(s, slab_nid(slab), slab->objects);

	if (unlikely(!pfmemalloc_match(slab, gfpflags))) {
		deactivate_slab(s, slab, get_freepointer(s, freelist));
		return freelist;
	}

retry_load_slab:

	local_lock_irqsave(&s->cpu_slab->lock, flags);
	if (unlikely(c->slab)) {
		void *flush_freelist = c->freelist;
		struct slab *flush_slab = c->slab;

		c->slab = NULL;
		c->freelist = NULL;
		c->tid = next_tid(c->tid);

		local_unlock_irqrestore(&s->cpu_slab->lock, flags);

		deactivate_slab(s, flush_slab, flush_freelist);

		stat(s, CPUSLAB_FLUSH);

		goto retry_load_slab;
	}
	c->slab = slab;

	goto load_freelist;
}
```

#### 释放

同样的是先尝试快速释放，不成功再慢速释放。下面直接慢速释放：

```c
static void __slab_free(struct kmem_cache *s, struct slab *slab,
			void *head, void *tail, int cnt,
			unsigned long addr)
{
	/* 1. 尝试原子更新slab的freelist和计数器 */
	do {
		prior = slab->freelist;           // 保存slab当前的freelist
		counters = slab->counters;        // 保存slab当前的状态计数器
		new.counters = counters;
		was_frozen = new.frozen;          // 记录slab是否被冻结（属于某个CPU）
		new.inuse -= cnt;                 // 减少已使用计数

		/* 2. 判断是否需要操作链表 */
		if ((!new.inuse || !prior) && !was_frozen) {
			// 如果slab变空，或原本是满的，且不属于任何CPU，需要操作链表
			n = get_node(s, slab_nid(slab));  // 获取所属NUMA节点
			spin_lock_irqsave(&n->list_lock, flags);  // 加节点锁
		}
	} while (!slab_update_freelist(s, slab, prior, counters, head, new.counters, "__slab_free"));

	/* 3. 根据更新后的状态处理slab */
	if (likely(!n)) {  // 没有获取节点锁，说明slab仍属于某个CPU
		if (likely(was_frozen)) {
			// slab仍冻结，属于某个CPU，无需其他操作
			return;
		} else if (kmem_cache_has_cpu_partial(s) && !prior) {
			// 原本是满的slab，现在有空间了，放入当前CPU的partial链表
			put_cpu_partial(s, slab, 1);
			return;
		}
	}

	/* 4. 需要操作节点链表的情况 */
	if (unlikely(!new.inuse && n->nr_partial >= s->min_partial)) {
		// slab变空且节点partial链表已够长，直接释放整个slab
		remove_partial(n, slab);  // 从partial链表移除
		discard_slab(s, slab);    // 释放给伙伴系统
		return;
	}

	/* 5. 将部分空闲的slab加入节点partial链表 */
	if (!kmem_cache_has_cpu_partial(s) && unlikely(!prior)) {
		add_partial(n, slab, DEACTIVATE_TO_TAIL);  // 加入链表尾部
	}
}
```

## 非连续管理区
