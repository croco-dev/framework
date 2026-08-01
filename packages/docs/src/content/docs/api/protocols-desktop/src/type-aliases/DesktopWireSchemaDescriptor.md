---
editUrl: false
next: false
prev: false
title: "DesktopWireSchemaDescriptor"
---

> **DesktopWireSchemaDescriptor** = [`DesktopWirePrimitiveDescriptor`](/api/protocols-desktop/src/type-aliases/desktopwireprimitivedescriptor/) \| [`DesktopWireLiteralDescriptor`](/api/protocols-desktop/src/type-aliases/desktopwireliteraldescriptor/) \| [`DesktopWireEnumDescriptor`](/api/protocols-desktop/src/type-aliases/desktopwireenumdescriptor/) \| [`DesktopWireObjectDescriptor`](/api/protocols-desktop/src/type-aliases/desktopwireobjectdescriptor/) \| \{ `element`: `DesktopWireSchemaDescriptor`; `kind`: `"array"`; \} \| \{ `inner`: `DesktopWireSchemaDescriptor`; `kind`: `"optional"`; \} \| \{ `inner`: `DesktopWireSchemaDescriptor`; `kind`: `"nullable"`; \} \| \{ `kind`: `"union"`; `options`: readonly `DesktopWireSchemaDescriptor`[]; \}
