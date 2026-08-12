---
title: linux驱动学习-设备树01-从设备树到probe
date: '2026-08-12'
lastmod: '2026-08-12'
tags: ['驱动', 'BSP', '笔记', '设备树']
draft: false
summary: '学习linux驱动，设备树是关键点。本章内容，与平时搜索到的不同，会从工程到理论的方向来分析。'
authors: ['default']
---

## 从硬件到probe

当前的linux驱动，离不开设备树，而从设备到用户是怎么建立的呢？大致以下流程：

1. 设备到DT：

设备树会记录该设备信息。比如说：

```dts
uart0: serial@10000000 { // 第一个用于其他设备结点引用，第二个是结点名称
    compatible = "vendor,my-uart"; // 设备型号名称，用于driver匹配
    reg = <0x10000000 0x1000>; // 第一个是物理地址，第二个是大小
    interrupts = <32>; // 表示中断号
    status = "okay"; // 是否启用
};
```

从设备树内容上看，包括了名字，物理地址，中断等各种信息。

2. DT到platform_device:

原始设备树是DTS，就是如上述一样的，可肉眼读的格式，但是要从DT源文件到设备节点，还需要将DTS编译为DTB(设备树二进制文件)，然后内核启动后通过`unflatten_device_tree()`得到一个方便内核读取的struct。

这时候它才会被一个`of_platform_populate()`变成platform_device

3. platform_device和platform_driver

platform_device是描述设备硬件信息，而要给予用户或者其他部分调用，就需要platform_driver。

它两如何匹配的呢，[原文](https://docs.kernel.org/driver-api/driver-model/platform.html)这么说的:

> These are concatenated, so name/id “serial”/0 indicates bus_id “serial.0”, and “serial/3” indicates bus_id “serial.3”; both would use the platform_driver named “serial”. While “my_rtc”/-1 would be bus_id “my_rtc” (no instance id) and use the platform_driver called “my_rtc”.

对于设备树创建的 platform_device，通常会通过 DT 节点中的 compatible 与 platform_driver 中的 of_match_table 进行匹配，匹配成功后再调用 probe()。

## DT节点不是platform_device

前面说了DTS会被变成live DT，然后被pupolate转为platform_device，但这并不是意味着DT节点==platform_device。如下:

```dts
soc {
    compatible = "simple-bus";

    i2c@1000 {
        compatible = "vendor,my-i2c";

        sensor@50 {
            compatible = "ti,tmp102";
        };
    };
};
```

首先，soc会被populate转为pdev，同时在compatible中的simple-bus标识是属于通用总线的标识，说明它还有子设备，会继续往下搜索。

I2C 控制器对应的 driver probe 后，会向 I2C core 注册 i2c_adapter；I2C core 再根据该总线下描述的设备创建对应的 i2c_client。[官方文档](https://docs.kernel.org/driver-api/i2c.html)如下解释：

> The Linux I2C programming interfaces support the master side of bus interactions and the slave side. The programming interface is structured around two kinds of driver, and two kinds of device. An I2C “Adapter Driver” abstracts the controller hardware; it binds to a physical device (perhaps a PCI device or platform_device) and exposes a struct i2c_adapter representing each I2C bus segment it manages. On each I2C bus segment will be I2C devices represented by a struct i2c_client. Those devices will be bound to a struct i2c_driver, which should follow the standard Linux driver model. There are functions to perform various I2C protocol operations; at this writing all such functions are usable only from task context.

因此这里存在两个层次：I2C 控制器由 i2c_adapter 表示，而挂在该 I2C 总线上的具体设备由 i2c_client 表示。

## probe也会取DT信息

```dts
reg = <...>;
interrupts = <...>;
```

虽然已经到达了probe，但还会需要DT中获取硬件资源

## phandle

设备树规范里讲：

> The phandle property specifies a numerical identifier for a node that is unique within the devicetree. The phandle property value is used by other nodes that need to refer to the node associated with the property.

也就是说phandle是用于引用某一结点的唯一标志。

如下例子：

```dts
i2s0: i2s@1000 {
    ...
};

sound {
    ...
    sound-dai = <&i2s0>;
};
```

对于这里dts被编译后会将i2s0变成一个唯一编号，用于sound来引用。而这个引用也可以带参数，如：

```dts
gpio0: gpio@1000 {
    ...
};

led {
    gpios = <&gpio0 15 0>;
};
```

## 参考文档

[1] [The Devicetree](https://devicetree-specification.readthedocs.io/en/v0.3/devicetree-basics.html)  
[2] [I2C and SMBus Subsystem](https://docs.kernel.org/driver-api/i2c.html)  
[3] [ASoC Machine Driver](https://docs.kernel.org/sound/soc/machine.html)  
[4] [Device Tree phandle: the C code point of view](https://bootlin.com/blog/dts-phandle-c-code)  
[5] [DeviceTree Kernel API](https://docs.kernel.org/devicetree/kernel-api.html)  
[6] [Platform Devices and Drivers](https://docs.kernel.org/driver-api/driver-model/platform.html)  
[7] [Linux and the Devicetree](https://docs.kernel.org/devicetree/usage-model.html)
