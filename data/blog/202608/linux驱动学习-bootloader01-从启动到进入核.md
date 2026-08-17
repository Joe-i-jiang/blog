---
title: linux驱动学习-bootloader01-从启动到进入核
date: '2026-08-17'
lastmod: '2026-08-17'
tags: ['驱动', 'BSP', '笔记', 'bootloader']
draft: false
summary: '学习linux驱动，需要学习启动流程。本章内容，个人简单理解从bootloader到kernel。'
authors: ['default']
---

## 从bootloader到kernel

从启动到进入核需要事先做好几步准备。

1. 初始化RAM

bootloader会事先初始化用于kernel的所有RAM的位置和大小，以便于内核的使用。

2. 建立设备树

设备树的起始位置需要以8byte对齐，且DTB自身不能超过2mb，同时不能存放在一些特定被使用的内存。

3. 解压内核镜像

AArch64 kernel 本身目前不提供 Image 解压器。如果使用 Image.gz 等压缩镜像，需要 bootloader 先解压；如果 bootloader 不支持，则直接使用未压缩的 Image。

4. 调用内核镜像

对于解压后的内核镜像分两部分，一个是进入镜像的步骤，一个是进入镜像前的配置。

4.1 首先是进入镜像步骤

在内核镜像被解压后，会存在一个header，用于记录镜像的一些信息，同时数据都是以小端序存储。如下：

```c
u32 code0;                    /* Executable code */
u32 code1;                    /* Executable code */
u64 text_offset;              /* Image load offset, little endian */
u64 image_size;               /* Effective Image size, little endian */
u64 flags;                    /* kernel flags, little endian */
u64 res2      = 0;            /* reserved */
u64 res3      = 0;            /* reserved */
u64 res4      = 0;            /* reserved */
u32 magic     = 0x644d5241;   /* Magic number, little endian, "ARM\x64" */
u32 res5;                     /* reserved (used for PE COFF offset) */
```

(1) code0/code1：可执行指令，用来跳转到内核真正的早期入口 stext

(2) text_offset：保存的从base到内核的偏移量。

(3) image_size：内核的大小。其中如果大小为0，则(2)可以被bootloader假定为0x80000（这是早期老版本兼容规则）。反之，bootloader需使用给出的image_size和text_offset的值。

(4) res5：保存的是PE header的偏移，PE header保存了 EFI 的入口指针，然后执行EFI stub，再跳回code0，进入正常kernel boot。

4.2 然后是进入内核前的准备

(1) 关闭所有DMA设备，避免这些设备继续向内存写入数据，破坏kernel使用的内存。

(2) CPU普通寄存器：x0保存设备树的物理地址；x1~x3 = 0，保留给未来使用。

(3) 所有中断的类型由PSTATE.DAIF掩盖。所有CPU处于non-secure状态，无论EL2，还是EL1。其中，EL2 是 Hypervisor 所在的异常级，EL1 是通常运行 OS kernel 的异常级；ARM64 Linux 可以从 non-secure EL1 或 EL2 进入，官方推荐有条件时从 EL2 进入。

(4) MMU必须关闭

(5) Instruction Cache 可以被开启或关闭，但不能残留于加载 kernel image 对应的旧缓存内容；kernel image 对应的位置需要 clean 到 PoC，以保证之后 kernel 看到的是正确的镜像内容。

(6) 进入 Kernel 前，架构定时器的频率等基础状态需要已经配置好，并且各 CPU 保持一致。如：CNTFRQ 和 CNTVOFF。

(7) 所有将被 Kernel 启动的 CPU，在进入 Kernel 时必须处于同一个 coherency domain。

> 除上述之外，更具体的 ARM64 架构初始化要求，这里暂不深入。

## 参考文档

[1] [Booting AArch64 Linux](https://docs.kernel.org/arch/arm64/booting.html)
