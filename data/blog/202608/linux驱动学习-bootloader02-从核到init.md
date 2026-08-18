---
title: linux驱动学习-bootloader02-从核到init
date: '2026-08-18'
lastmod: '2026-08-18'
tags: ['驱动', 'BSP', '笔记', 'init']
draft: false
summary: '学习linux驱动，需要学习启动流程。本章内容，个人简单理解从核到init。'
authors: ['default']
---

## 从核到init

前面从启动进入了内核，下面是从进入内核开始到init用户空间的流程。

### ramfs 和 ramdisk 和 tmpfs

#### ramfs

ramfs 是一个基于 Linux page cache 和 dentry cache 实现的内存文件系统。与普通磁盘文件系统不同，它没有 backing store，因此写入其中的数据没有地方可以写回，内存也不能通过这种方式释放。

#### ramdisk

早期使用的是ramdisk，它的流程大致如下：

RAM  
 ↓  
模拟 block device  
 ↓  
在上面再建立 ext2 等 filesystem  
 ↓  
数据又进入 page cache

拿一块 RAM 模拟硬盘，然后又让文件系统把“硬盘数据”缓存进 RAM。所以出现了额外复制、固定大小、额外文件系统驱动等问题；相比之下 ramfs 直接使用 page/dentry cache，更简单。

#### tmpfs

tmpfs 可以看作 ramfs 的改进版本，它支持大小限制，并且能够使用 swap，因此更适合作为提供给用户使用的内存文件系统。

### rootfs

rootfs 是 Linux 启动时始终存在的一个特殊 ramfs（启用 tmpfs 时也可以使用 tmpfs）实例，它处在 Linux VFS 根文件系统的位置。

### init

rootfs 本身只是启动时存在的根文件系统。initramfs 的内容被解包到 rootfs 后，如果其中存在 /init，kernel 就会执行它，开始进入用户空间。

#### initrd

这是早期的初始化方式，它本身是一个单一的文件，属于压缩后的filesystem image，放在RAM作为块设备或者ramdisk，然后被挂在到rootfs上。

#### initramfs

这是现在的初始化方式，它是由cpio压缩成一个包，然后在解压后直接就成为了rootfs下的内容。随后找到init做初始化，直接执行用户空间的初始化。

## 参考文档

[1] [Ramfs, rootfs and initramfs](https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html)
