---
title: linux驱动学习-设备树02-linux如何管理gpio资源
date: '2026-08-20'
lastmod: '2026-08-21'
tags: ['驱动', 'BSP', '笔记', '设备树', 'gpio']
draft: false
summary: '学习linux驱动，设备树是关键点。本章内容，是从设备树上soc pin到Linux gpio，再到具体设备调用。'
authors: ['default']
---

## 示例图

```dts
/ {
    model = "example board";

    /*
     * 一个 LED，使用 GPIO
     */
    led {
        compatible = "gpio-leds";

        status_led {
            gpios = <&gpio1 5 GPIO_ACTIVE_HIGH>;
            default-state = "on";
        };
    };


    /*
     * UART设备
     */
    uart0: serial@10000000 {
        compatible = "vendor,uart";
        reg = <0x10000000 0x1000>;

        pinctrl-names = "default";
        pinctrl-0 = <&uart0_pins>;

        status = "okay";
    };


    /*
     * I2C控制器
     */
    i2c0: i2c@20000000 {
        compatible = "vendor,i2c";
        reg = <0x20000000 0x1000>;

        pinctrl-names = "default";
        pinctrl-0 = <&i2c0_pins>;

        status = "okay";


        /*
         * I2C上的设备
         */
        temp_sensor@48 {
            compatible = "ti,tmp102";
            reg = <0x48>;
        };
    };


    /*
     * pin controller
     */
    iomuxc: pinctrl@30000000 {

        compatible = "vendor,pinctrl";
        reg = <0x30000000 0x1000>;

        pinctrl-names = "default";
        pinctrl-0 = <&pinctrl_hog_1>;

        /*
         * 1. hog
         *
         * 没有设备引用它
         * pinctrl初始化时自动应用
         */
        pinctrl_hog_1 :hoggrp {

            gpio_default_pins {

                pins = <
                    PIN_A5 GPIO
                >;

                bias-pull-up;
            };
        };


        /*
         * 2. UART group
         */
        uart0_pins: uart0grp {

            pins = <
                PIN_B1 UART0_TX
                PIN_B2 UART0_RX
            >;

            /*
             * 电气配置
             */
            bias-pull-up;
            drive-strength = <8>;
        };


        /*
         * 3. I2C group
         */
        i2c0_pins: i2c0grp {

            pins = <
                PIN_C3 I2C0_SCL
                PIN_D7 I2C0_SDA
            >;

            bias-pull-up;
            drive-open-drain;
        };


        /*
         * 4. SD card group
         */
        usdhc0_pins: usdhc0grp {

            pins = <
                PIN_E1 SD_CLK
                PIN_E2 SD_CMD
                PIN_E3 SD_DATA0
                PIN_E4 SD_DATA1
            >;
        };

    };


    /*
     * GPIO controller
     */
    gpio1: gpio@40000000 {

        compatible = "vendor,gpio";

        reg = <0x40000000 0x1000>;

        gpio-controller;
        #gpio-cells = <2>;

        /*
         * GPIO和pinctrl pin编号映射
         */
        gpio-ranges = <
            &iomuxc 0 0 32
        >;
    };
};
```

## pinctrl如何管理pin

总所周知，pin是用于各类传输，比如：I2C，UART，GPIO等。但是，比如说I2C要有SDA和SCL，那么就得同时调多个pin，所以就存在组，又如：`usdhc0_pins: usdhc0grp`就存在调用多个pin。

对于各种组，存在复用，比如：某个pin，即会作为gpio，又要作为uart的tx。这时候如果将组交给设备自己管理，将会很麻烦。所以就有pinctrl管理pin的复用和配置状态（group只是组织这些pin的一种方式）。

在示例中，iomuxc就是一个pinctrl的实例。所以iomuxc 这个 pin controller 节点下面定义的 pin group 都是由pinctrl管理。

注意到，其中`pinctrl_hog_1`被iomuxc自己引用，这个就会在iomuxc自己probe时就生效了。而其他，就需要在具体设备引用时生效。

## 设备怎么调用gpio

从设备树上看，设备在注册时，就将所需的引脚注册，如led将所需的gpio通过指定编号，指定类型引用并定义了，当然也可以如上用一个iomuxc内包含的group。

在设备与其driver匹配后，触发probe，然后调用 GPIO framework 获取 GPIO，然后GPIO framework 找 GPIO controller，然后 GPIO controller driver 操作 GPIO hardware。

而其中 pinctrl 主要关注 这个 pin 当前是什么功能，这个 pin 的电气配置。

## 参考文档

[1] [PINCTRL (PIN CONTROL) subsystem](https://docs.kernel.org/driver-api/pin-control.html)  
[2] 【正点原子】I.MX6U嵌入式Linux驱动开发指南V1.6
