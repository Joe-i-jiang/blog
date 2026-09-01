---
title: linux驱动学习-设备树03-clock系统
date: '2026-09-01'
lastmod: '2026-09-01'
tags: ['驱动', 'BSP', '笔记', '设备树', 'clock']
draft: false
summary: '学习linux驱动，设备树是关键点。本章内容，是简述从物理到设备调用的clock系统流程。'
authors: ['default']
---

## 物理上的clock

clock是给数字电路提供时序基准，使内部逻辑按照一定节奏工作。但在实际物理电路中，并不是固定频率，或者是需要统一开关，所以就涉及到一套流程。

### 主要的物理模块

```
clock source
    ↓
PLL (它在其他之前是因为，需要先将源低频时钟，变成一个更适合系统的高频时钟，而放在后面意义不大)
    ↓
mux / divider / gate
    ↓
consumer
```

其中：

provider 是 Linux Clock Framework 中“提供 clock”的角色，不是 PLL/gate 一类物理模块。

pll是将频率按倍率增加的

gate是控制clock开关的

mux是多对一，将多个选择其中一个作为输出的

divider是将频率进行分频的，比如：600 MHz / 2 = 300 MHz。和上面的pll相反。

consumer就是消费者，使用这些clock

### provider

一个clock tree可能具有多个provider，比如：

```
osc24M
└── Provider A

controller

PLL
AHB
UART
└── Provider B
```

它是由外源提供的clock，因此controller并不能操作osc24M，但把它当作了输入源。所以，一个 Clock provider 自己也可以同时是另一个 Clock 的 consumer。

比如下面设备树，也直观表示controller：

```dts
osc24m: oscillator {
    compatible = "fixed-clock";
    #clock-cells = <0>;
    clock-frequency = <24000000>;
};

ccu: clock-controller@30000000 {
    clocks = <&osc24m>;
};
```

### clock controller

和前面的gpio一样，它也有一个controller，同时这里也间接对前面gpio补充。clock controller实际是一个物理硬件模块，相当于一个device，它也有对应的driver，而上层还有一个子系统（subsystem）来调用driver来操作这个控制器，再由控制器间接操作实际clock。即：

```
consumer driver
      ↓
Clock Framework
      ↓
clock provider driver
      ↓
PLL / mux / divider / gate 等 clock hardware
      ↓
clock signal
      ↓
设备硬件
```

这条流程对应上面相反，是从上到下的。

## 软件上的clock

要从具体的consumer去操作这个clock，那么就要涉及对应关系，而前面也说明了流程，下面提供一些数据结构等

### 主要数据结构

有两个数据结构，很容易混淆，clk和clk_hw。

其中struct clk 是 consumer 一侧获取并使用的 clock 句柄。同一条底层 clock 可以被多个 consumer 使用，各 consumer 可以持有自己的 struct clk。

而clk_hw 是 provider 一侧用于描述具体硬件 clock 及其底层实现的信息。比如 gate 如何开关、mux 如何选择 parent、divider 如何分频。

而其他api或者数据结构，暂不再深入讨论

## 整体流程

实际上某个设备需要调用clock时，只是在软件层面去操作，最后再硬件层面返回。

```
             软件
────────────────────────────

UART driver
    │
    │ clk_prepare_enable()
    ↓
Clock Framework
    ↓
clock provider driver
    │
    │ 写寄存器
    ↓

────────────────────────────
             硬件

Clock Controller
    │
    │ clock signal
    ↓
UART Controller
```

## 参考文档

[1] [The Common Clk Framework](https://www.kernel.org/doc/html/latest/driver-api/clk.html)  
[2] [Clock子系统](https://www.cnblogs.com/jliuxin/p/14129290.html)
