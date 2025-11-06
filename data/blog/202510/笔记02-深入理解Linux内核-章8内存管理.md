---
title: 笔记02-深入理解Linux内核-章8内存管理
date: '2025-10-23'
lastmod: '2025-11-06'
tags: ['深入理解Linux内核', 'Linux内核', '笔记', '内存']
draft: false
summary: '阅读深入理解linux内核，第八章，笔记。'
authors: ['default']
---

## 页框管理

RAM的某些部分永久分配给内核，存放内核代码以及静态内核数据结构。而其余部分就是动态内存。  
下面是用作动态内存的页框，和章2的物理内存布局一致  
**_链接1_**

### 页描述符

内核必须记录每个页框的状态。比如：哪些是进程的，哪些是内核代码，哪些是内核数据等。如果动态内存不包含有用的数据，就是空闲的。  
页框的状态信息保存在一个类型为`page`的页描述符中。所有的页描述符存放在`mem_map`数组中。  
`virt_to_page(addr)`宏产生线性地址对应的页描述符，`pfn_to_page`宏产生页框号对应的页描述符。  
下面是页描述符字段：

1. `unsigned long flags`：一组标志。
2. `atomic_t _count`：页框引用计数。
3. `atomic_t _mapcount`：页框中的页表项数。
4. `unsigned long private`：用于正在使用页的内核成分。空闲时，由伙伴关系使用。
5. `struct address_space * mapping`：当页被插入页高速缓存中时使用。当页属于匿名区时使用。
6. `unsigned long index`：具有不同含义。
7. `struct list_head lru`：包含页的最近最少使用（LRU）双向链表的指针。

#### **flag**字段

包含多达32位的标志。对每个标志`PG_*`，定义了一些宏。`Page*`返回值；`SetPage*`和`ClearPage*`表示设置和清除。  
**_链接2_**

### 非一致内存访问（NUMA）

对于单一cpu，对物理内存的访问时间都相同，但对于多处理器不一定。  
对于支持NUMA的模型的cpu访问不同内存时间可能不一样。系统的物理内存分为了几个节点。而对于每个CPU来说，内核都试图将访问的次数减到最少。

> **空洞**：
> "空洞"指的是物理地址空间中的不连续区域。比如
>
> ```c
> // 典型的物理地址空间布局（有空洞）
> +---------------------+ 0x00000000
> |   节点0内存         |
> |   (连续)           |
> +---------------------+ 0x20000000  ← 空洞开始
> |     空洞区域        |
> |   (无物理内存)      |
> +---------------------+ 0x40000000  ← 空洞结束
> |   节点1内存         |
> |   (连续)           |
> +---------------------+ 0x60000000
> |     空洞区域        |
> |   (无物理内存)      |
> +---------------------+ 0x80000000
> |   节点2内存         |
> |   (连续)           |
> +---------------------+ 0xA0000000
> ```
>
> 而对于某些单一的cpu系统上使用了**NUMA**可能会造成巨大的**空洞**。例如：
>
> ```c
> // 即使只有一个物理CPU，NUMA架构也强制使用多节点内存映射
> +-----------------------------+
> |       单一物理CPU           |
> |   (包含多个核心和内存控制器)  |
> +-----------------------------+
> | 内存控制器0  | 内存控制器1   |
> | 映射到节点0  | 映射到节点1   |
> +-------------+---------------+
> | 本地内存    | 本地内存       |
> | 0-16GB      | 16-32GB       |
> +-------------+---------------+
>
> // 问题：两个内存控制器的地址空间必须隔离
> // 导致：节点0: 0x0 - 0x400000000 (16GB)
> //       节点1: 0x800000000 - 0xC00000000 (16GB)
> //       中间空洞: 0x400000000 - 0x800000000 (16GB空洞!)
> ```
>
> 每个节点的物理内存又可以分为几个管理区。每个节点有一个类型为`pg_data_t`的描述符。所有节点都放在单链表，第一个变量由`pgdat_list`指向。  
> 节点描述符表[略]

即使NUMA的支持没有编译进内核，但linux还是使用节点，一个节点包含了所有物理内存。这样做的原因是为了可移植性，假设物理内存被分为一个或多个节点。

### 内存管理区

linux2.6将每个内存节点的物理内存分为3个管理区。

1. `ZONE_DMA`：包含低于16MB的内存页框。
2. `ZONE_NORMAL`：包含高于16MB并且低于896MB的内存页框。可以和`ZONE_DMA`一样，直接访问线性地址映射到的第四个GB的物理内存。
3. `ZONE_HIGHMEM`：包含高于且等于896MB的内存页框。不能由内核直接访问。在64位体系上，`ZONE_HIGHMEM`区总是空的。
   > ISA总线的直接内存存取(DMA)处理器有一个严格的限制:它们只能对RAM的前16MB寻址。  
   > 在具有大容量RAM的现代32位计算机中，CPU不能直接访问所有的物理内存，因为线性地址空间太小。

> 每个内存管理区都有自己的描述符。这里略。

每个页描述符都有到内存节点和到节点内管理区的链接。为了节省空间，这种链接的存在方式是被编码成引索存放到`flags`字段的高位。  
例如64位:

```c
// 32位系统的page->flags位分配（32位）
+-------------------------------------------------+
| 31 - 24    | 23 - 16    | 15 - 8     | 7 - 0    |
+-------------------------------------------------+
| 未使用      | 节点ID      | 管理区ID    | 页状态位  |
+-------------------------------------------------+

// 具体定义：
#define NODES_SHIFT     8   // 但实际可能只用2-3位
#define ZONES_SHIFT     8   // 实际只用2-3位
#define NODES_PGSHIFT   (ZONES_SHIFT + ZONES_PGSHIFT)
#define ZONES_PGSHIFT   (/* 其他标志位占用的位数 */)
```

如图之前所述。  
如果不支持NUMA，那么flags中管理区索引占两位，节点索引占1位（通常设为0）。  
如果支持，且32位上，flags中管理区flags中管理区索引占两位，节点索引占六位。  
支持且64位上，flags中管理区索引占两位，节点索引占十位。

### 保留的页框池

当请求内存时，为了保证某些内核不能备阻塞，例如原子内存分配，内核为原子内存分配请求保留了一个页框池，只有在内存不足时才使用。  
保留内存数量，以KB为单位，存在`min_free_kbytes`变量中一般初始值，取决于，直接映射到内核线性地址空间的第四个GB物理内存的数量，即`ZONE_DMA`和`ZONE_NORMAL`的页框数量，贡献数量与之间大小成比例。

<center>保留池大小 = $\left\lfloor \sqrt{16 \times \text{直接映射内存}} \right\rfloor$</center>

### 分区页框分配器

用于处理对连续页框组的内存分配请求。下图组成。  
**_链接3_**  
其中管理区分配器接受动态内存分配与释放的请求。分配内存时，页框被伙伴系统来处理。

> 为了更好的性能，其中一小块儿页框保留在高速缓存中。

<div id="top">
#### 请求与释放页框
</div>
6个函数或宏请求页框：

1. `alloc_pages(gfp_mask, order)`：请求$2^\text{order}$个连续的页框。返回第一个分配的页框描述符的地址。
2. `alloc_page(gfp_mask)`：相当于`alloc_page(gfp_mask, 0)`。
3. `__get_free_pages(gfp_mask, order)`：同1，但返回第一个所分配页的线性地址。
4. `__get_free_page(gfp_mask)`：相当于`__get_free_pages(gfp_mask, 0)`。
5. `get_zeroed_page(gfp_mask)`：获取填满0的页框。相当于`alloc_pages(__GFP_ZERO | gfp_mask, 0)`。但返回的是页框的线性地址。
6. `__get_dma_pages(gfp_mask, order)`：获得适用于DMA的页框。相当于`__get_free_pages(__GFP_DMA | gfp_mask, order)`

其中请求页框的标志如下：  
**_链接4_**

4个释放页框的函数或宏：

1. `__free_pages(page, order)`和`__free_page(page)`：输入为页框地址，检测描述符，`PG_reserved`为0时，就将count-1，变为0时。就会释放页框。
2. `free_pages(addr, order)`和`free_page(addr)`：参数为线性地址。

### 高端内存页框的内核映射

该内存的起始点对应的线性地址在`high_memory`变量中，为896MB，但并不能直接映射到第4GB，所以不能用`__get_free_pages()`，也就是说，ZONE_HIGHMEM管理区是空的。  
内核采用三种不同的机制将页框映射到高端内存，分别是：[永久内核映射](#top)、临时内核映射和非连续内存分配。对应三种不同的映射，128MB的空间，4MB分配于永久内核映射，4MB分配于临时内核映射，其余为非连续内存。

#### 永久内核映射

它们使用主内核页表中一个专门的页表，地址存在`pkmap_page_table`变量中。表项数由`LAST_PKMAP`宏产生，多少取决于PAE是否被激活。  
页表的映射地址起始点为`PKMAP_BASE`。每个`pkmap_page_table`都有一个``pkmap_count`的计数器。当为0时，页表可用；当为1时，页表未被TLB刷新，不可用；当为n时，有n-1个正在使用该页框。

为记录高端页框与永久内核映射包含的线性地址之间的联系，内核使用了`page_address_htable`散列表，该表包含一个page_address_map数据结构，用于为高端内存中的每个页框进行映射。

```c
// linux version : 6.17.2
/*
 * Describes one page->virtual association
 */
struct page_address_map {
	struct page *page;
	void *virtual;
	struct list_head list;
};

static struct page_address_map page_address_maps[LAST_PKMAP];

/*
 * Hash table bucket
 */
static struct page_address_slot {
	struct list_head lh;			/* List of page_address_maps */
	spinlock_t lock;			/* Protect this bucket's list */
} ____cacheline_aligned_in_smp page_address_htable[1<<PA_HASH_ORDER];

static struct page_address_slot *page_slot(const struct page *page)
{
	return &page_address_htable[hash_ptr(page, PA_HASH_ORDER)];
}
```

`page_address`通过页框返回线性地址。

1. 如果存在高端内存，但未被映射，返回NULL。
2. 如果不存在高端内存里（即：PG_Highmem=0），则线性地址总是存在，可以通过页框下标得到对应的物理地址，再将物理地址转换为线性地址。

```c
#define page_to_virt(page)	__va(((((page) - mem_map) << PAGE_SHIFT) + PAGE_OFFSET))
```

3. 如果存在高端内存里，则通过`page_address_htable`表获得。

`kmap()`函数建立永久内核映射时。如果页框属于高端内存，则会调用`kmap_high()`函数。

```c
// linux version : 6.17.2
/**
 * kmap_high - map a highmem page into memory
 * @page: &struct page to map
 *
 * Returns the page's virtual memory address.
 *
 * We cannot call this from interrupts, as it may block.
 */
void *kmap_high(struct page *page)
{
	unsigned long vaddr;

	/*
	 * For highmem pages, we can't trust "virtual" until
	 * after we have the lock.
	 */
	lock_kmap();
	vaddr = (unsigned long)page_address(page);
	if (!vaddr)
		vaddr = map_new_virtual(page);
	pkmap_count[PKMAP_NR(vaddr)]++;
	BUG_ON(pkmap_count[PKMAP_NR(vaddr)] < 2);
	unlock_kmap();
	return (void *) vaddr;
}
```

通过上面的`page_address`获取线性地址，如果未被分派，则调用`map_new_virtual`，其主要分为2个模块。

1. 第一个模块是查找有没有空闲位置，搜索过程是如果第一轮没搜到，就用`flush_all_zero_pkmaps`对TLB缓存表刷新，再搜索，有的话就分配给`page_address_htable`，没有就进入下一步。

```c
	count = get_pkmap_entries_count(color);
	/* Find an empty entry */
	for (;;) {
		last_pkmap_nr = get_next_pkmap_nr(color);
		if (no_more_pkmaps(last_pkmap_nr, color)) {
			flush_all_zero_pkmaps();
			count = get_pkmap_entries_count(color);
		}
		if (!pkmap_count[last_pkmap_nr])
			break;	/* Found a usable entry */
		if (--count)
			continue;
```

2. 第二个模块是如果没空位就休眠，并转让CPU，被唤醒后先查询是否被其他进程分配，如果没有回到第一步。

```c
		/*
		 * Sleep for somebody else to unmap their entries
		 */
		{
			DECLARE_WAITQUEUE(wait, current);
			wait_queue_head_t *pkmap_map_wait =
				get_pkmap_wait_queue_head(color);

			__set_current_state(TASK_UNINTERRUPTIBLE);
			add_wait_queue(pkmap_map_wait, &wait);
			unlock_kmap();
			schedule();
			remove_wait_queue(pkmap_map_wait, &wait);
			lock_kmap();

			/* Somebody else might have mapped it while we slept */
			if (page_address(page))
				return (unsigned long)page_address(page);

			/* Re-start */
			goto start;
		}
```

相反，`kunmap()`函数解除永久内核映射时。如果页框属于高端内存，则会调用`kunmap_high()`函数。该函数会将count-1，如果此时count=1，则被认为无进程在使用，然后进行唤醒其他使用该页的进程。

```c
void kunmap_high(struct page *page)
{
	unsigned long vaddr;
	unsigned long nr;
	unsigned long flags;
	int need_wakeup;
	unsigned int color = get_pkmap_color(page);
	wait_queue_head_t *pkmap_map_wait;

	lock_kmap_any(flags);
	vaddr = (unsigned long)page_address(page);
	BUG_ON(!vaddr);
	nr = PKMAP_NR(vaddr);

	/*
	 * A count must never go down to zero
	 * without a TLB flush!
	 */
	need_wakeup = 0;
	switch (--pkmap_count[nr]) {
	case 0:
		BUG();
	case 1:
		/*
		 * Avoid an unnecessary wake_up() function call.
		 * The common case is pkmap_count[] == 1, but
		 * no waiters.
		 * The tasks queued in the wait-queue are guarded
		 * by both the lock in the wait-queue-head and by
		 * the kmap_lock.  As the kmap_lock is held here,
		 * no need for the wait-queue-head's lock.  Simply
		 * test if the queue is empty.
		 */
		pkmap_map_wait = get_pkmap_wait_queue_head(color);
		need_wakeup = waitqueue_active(pkmap_map_wait);
	}
	unlock_kmap_any(flags);

	/* do wake-up, if needed, race-free outside of the spin lock */
	if (need_wakeup)
		wake_up(pkmap_map_wait);
}
EXPORT_SYMBOL(kunmap_high);
```

#### 临时内核映射

> 目前64位已经支持所有内存映射，几乎不再使用临时内核映射，所以这里不再专门说高端内存的映射。

临时映射主要有三种方法：

1. `kmap_local_page()`：它能在任何上下文中调用（包括中断），但映射只能从获取它们的上下文中使用。同时在可行情况下，应当比其他所有的函数优先使用。
2. `kmap_atomic()`：允许对单个页面进行非常短的时间映射，但被限制在发布它的CPU上。它可以被中断上下文使用，因为不睡眠。同时每次调用时都会创建一个不可抢占的段，并禁用缺页异常。但也会被别的抢占。
3. `kmap()`：对抢占和迁移没限制，但开销大。不需要再映射必须用`kunmap()`释放。

参考文档：[高内存处理](https://www.kernel.org/doc/html/latest/translations/zh_CN/mm/highmem.html)

#### 伙伴系统

伙伴系统是用于高效管理内存分配的系统，将外碎片分成了11组链表，分别表示1,2,4,8,16,32,64,128,256,512,1024个连续的页框。

##### 数据结构

1. 每个内存节点`struct pglist_data`包含多个内存区域`struct zone`，每个区域中都有伙伴系统的数据结构。
2. 在`struct zone`中，伙伴系统的核心数据结构是`free_area`数组，数组的索引表示阶`order`，即块的大小为$2^\text{order}$个页框。

```c
/*
* 内存区域（zone）中的伙伴系统结构
**/
struct zone {
    // ...

    /* 伙伴系统核心数据结构 */
    struct free_area free_area[MAX_ORDER];

    // 每CPU页面缓存
    struct per_cpu_pageset __percpu *pageset;

    // 内存水位线
    unsigned long watermark[NR_WMARK];  // WMARK_MIN, WMARK_LOW, WMARK_HIGH

    // 保护锁
    spinlock_t lock;

    // ...
};

/*
* 空闲区域描述符（free_area）
**/
#define MAX_ORDER 11  // 通常为11，最大支持2^10=1024个连续页框

struct free_area {
    struct list_head free_list[MIGRATE_TYPES];  // 按迁移类型分类的空闲链表
    unsigned long nr_free;                      // 该阶数的空闲块总数
};

// 迁移类型定义（防止内存碎片）
enum migratetype {
    MIGRATE_UNMOVABLE,      // 不可移动页（内核核心数据）
    MIGRATE_MOVABLE,        // 可移动页（用户进程内存）
    MIGRATE_RECLAIMABLE,    // 可回收页（文件缓存等）
    MIGRATE_PCPTYPES,       // 每CPU页面类型
    MIGRATE_HIGHATOMIC,     // 高阶原子分配
    MIGRATE_CMA,            // 连续内存分配器
    MIGRATE_ISOLATE,        // 不能从此链表分配
    MIGRATE_TYPES           // 类型总数
};

/*
* 页面描述符中的伙伴系统信息
**/
struct page {
    // 伙伴系统相关字段
    struct list_head lru;           // 用于链接到空闲链表
    unsigned long private;          // 用于存储伙伴系统的阶数(order)

    // 引用计数和标志位
    atomic_t _refcount;
    unsigned long flags;

    // ...
};
```

##### 分配块

先看linux6.17.2版本的分配流程。
`alloc_pages` -> `alloc_hooks(alloc_pages_noprof(__VA_ARGS__))` -> `alloc_pages_node_noprof` -> `__alloc_pages_node_noprof` -> `__alloc_pages_noprof` -> `__alloc_frozen_pages_noprof` -> `get_page_from_freelist` -> `rmqueue` -> `rmqueue_buddy` -> `__rmqueue_smallest`或`__rmqueue`。虽然究极长，但前面一堆废话，也暂时不必关系，所以主要从下面开始。

1. `__alloc_frozen_pages_noprof`：实际分配的主要入口。

```c
/*
 * This is the 'heart' of the zoned buddy allocator.
 */
struct page *__alloc_frozen_pages_noprof(gfp_t gfp, unsigned int order,
		int preferred_nid, nodemask_t *nodemask)
{
	// ...
	if (!prepare_alloc_pages(gfp, order, preferred_nid, nodemask, &ac,
			&alloc_gfp, &alloc_flags))
		return NULL;

	/*
	 * Forbid the first pass from falling back to types that fragment
	 * memory until all local zones are considered.
	 */
	alloc_flags |= alloc_flags_nofragment(zonelist_zone(ac.preferred_zoneref), gfp);

	/* First allocation attempt */
	page = get_page_from_freelist(alloc_gfp, order, alloc_flags, &ac);
	if (likely(page))
		goto out;

	alloc_gfp = gfp;
	ac.spread_dirty_pages = false;

	/*
	 * Restore the original nodemask if it was potentially replaced with
	 * &cpuset_current_mems_allowed to optimize the fast-path attempt.
	 */
	ac.nodemask = nodemask;

	page = __alloc_pages_slowpath(alloc_gfp, order, &ac);
	// ...
}
```

2. `get_page_from_freelist`：会遍历`zonelist`，在每个`zone`中尝试分配。在`zone`中，分配是通过`rmqueue`函数完成的。

```c
static struct page *get_page_from_freelist(gfp_t gfp_mask, unsigned int order,
                      int alloc_flags, const struct alloc_context *ac)
{
    struct zoneref *z;
    struct zone *zone;
    struct page *page = NULL;

    // 遍历所有合适的内存区域
    for_next_zone_zonelist_nodemask(zone, z, ac->highest_zoneidx,
					ac->nodemask) {
        // 检查水位线
 		if (zone_watermark_fast(zone, order, mark,
					ac->highest_zoneidx, alloc_flags,
					gfp_mask))
		// ...

        // 尝试从伙伴系统分配
 		page = rmqueue(zonelist_zone(ac->preferred_zoneref), zone, order,
				gfp_mask, alloc_flags, ac->migratetype);
		if (page) {
			prep_new_page(page, order, gfp_mask, alloc_flags);

			/*
			 * If this is a high-order atomic allocation then check
			 * if the pageblock should be reserved for the future
			 */
			if (unlikely(alloc_flags & ALLOC_HIGHATOMIC))
				reserve_highatomic_pageblock(page, order, zone);

			return page;
		} else {
			// ...
		}
	}
	// ...

    return NULL;
}
```

3. `rmqueue`：会先在per-CPU进行分配，不行就伙伴系统。

```c
static inline
struct page *rmqueue(struct zone *preferred_zone,
			struct zone *zone, unsigned int order,
			gfp_t gfp_flags, unsigned int alloc_flags,
			int migratetype)
{
	struct page *page;

	// 1. 首先尝试从 PCP 分配
	if (likely(pcp_allowed_order(order))) {
		page = rmqueue_pcplist(preferred_zone, zone, order,
				       migratetype, alloc_flags);
		if (likely(page))
			goto out;  // PCP 分配成功，直接返回
	}

	// 2. PCP 分配失败，回退到伙伴系统
	page = rmqueue_buddy(preferred_zone, zone, order, alloc_flags,
							migratetype);

	// ...
	return page;
}
```

4. `rmqueue_buddy`：首先是在指定迁移类型中分配`__rmqueue_smallest`，指定的分配不了，再去其他迁移类型中分配`__rmqueue`。

```c
static __always_inline
struct page *rmqueue_buddy(struct zone *preferred_zone, struct zone *zone,
			   unsigned int order, unsigned int alloc_flags,
			   int migratetype)
{
	// ...
	do {
		if (alloc_flags & ALLOC_HIGHATOMIC)
			page = __rmqueue_smallest(zone, order, MIGRATE_HIGHATOMIC);
		if (!page) {
			enum rmqueue_mode rmqm = RMQUEUE_NORMAL;

			page = __rmqueue(zone, order, migratetype, alloc_flags, &rmqm);

			/*
			 * If the allocation fails, allow OOM handling and
			 * order-0 (atomic) allocs access to HIGHATOMIC
			 * reserves as failing now is worse than failing a
			 * high-order atomic allocation in the future.
			 */
			if (!page && (alloc_flags & (ALLOC_OOM|ALLOC_NON_BLOCK)))
				page = __rmqueue_smallest(zone, order, MIGRATE_HIGHATOMIC);

			if (!page) {
				spin_unlock_irqrestore(&zone->lock, flags);
				return NULL;
			}
		}
	} while (check_new_pages(page, order));
	// ...
}
```

5. `__rmqueue_smallest`：其他类型最后也是调这个，所以只关心这个功能。事实上，到这一步就真正是伙伴系统在分配内存了。

```c
static __always_inline
struct page *__rmqueue_smallest(struct zone *zone, unsigned int order,
						int migratetype)  // ← 迁移类型参数
{
	unsigned int current_order;
	struct free_area *area;
	struct page *page;

	/* 在指定迁移类型的空闲链表中查找合适大小的页面 */
	for (current_order = order; current_order < NR_PAGE_ORDERS; ++current_order) {
		area = &(zone->free_area[current_order]);
		page = get_page_from_free_area(area, migratetype);  // ← 关键：按迁移类型获取
		if (!page)
			continue;

		page_del_and_expand(zone, page, order, current_order,
				    migratetype);  // ← 迁移类型传递到拆分逻辑
		return page;
	}
	return NULL;
}
```

##### 释放块
