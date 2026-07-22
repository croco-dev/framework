---
editUrl: false
next: false
prev: false
title: "OnShutdown"
---

> **OnShutdown**(): `MethodDecorator` & `ClassDecorator`

클래스 또는 인스턴스 메서드에 애플리케이션 종료 훅을 연결하는 데코레이터입니다.

클래스와 메서드에 함께 적용하면 메서드 선언이 우선하며 생성자당 하나의 훅만 등록됩니다.
클래스에 상속된 메서드 선언은 가장 가까운 데코레이터 선언의 함수를 사용합니다.

## Returns

`MethodDecorator` & `ClassDecorator`
