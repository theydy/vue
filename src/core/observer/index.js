/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
export const observerState = {
  shouldConvert: true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
export class Observer {
  value: any;
  /**
   * this.value 指向双向绑定的对象。
   */
  dep: Dep;
  /**
   * 这个dep 实例存放这个对象收集到的依赖Watcher
   */
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      const augment = hasProto
        ? protoAugment
        : copyAugment
      /**
       * hasProto 检测环境是否支持_proto_ 属性，
       * 如果支持，则使用原型链的方法来改变Array 的变异方法，
       * 不支持，则直接重写Array 的变异方法，
       * 之所以这样做，是为了能够捕获到Array 的getter, setter，
       * 但是Vue 无法捕获通过下标操作Array 的getter, setter。 
       */
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
      /**
       * observeArray 遍历value，为每一个属性执行一次observe(item) 观测，
       * 不过如果这个item 不是Object, Array 的话observe 开头就直接返回了，
       * 所以其实只是针对Object, Array 的操作。
       * 也只有Object, Array 才会有__ob__ 属性指向一个Observer 实例。
       */
    } else {
      this.walk(value)
      /**
       * walk 这个函数只是遍历value 上的属性执行defineReactive(value, key, value[key])，
       * 递归和设置getter, setter 都是在defineReactive 函数中执行的。
       */
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
    /**
     * 如果value 不是一个Object, Array 或者value 是一个VNode 实例，直接返回。
     */
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
    /**
     * 如果value.__ob__ 不为空，说明value 已经被观测过了。
     * 而这个Observer 实例被保存在value.__ob__ 上。
     * 在Observer 类构造函数中有这么一句
     * def(value, '__ob__', this)
     * 功能上类似value.__ob__ = this，而this 就是一个Observer 实例。
     */
  } else if (
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
    /**
     * 如果是Vue 根实例，ob.vmCount++ ，一般组件的ob.vmCount = 0，
     * 用于在Vue.prototype.$set, Vue.prototype.$del 中
     * 阻止在Vue 根实例上添加和删除响应式的属性。
     */
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()
  /**
   * 如果要观测的数据是Object 对象，则对于这个Object 下的每一个属性，都会运行到这一步。
   * 都会新创建一个Dep 实例，后面设置getter, setter 通过闭包调用操作这个dep。
   * 而对于这个Object 对象的__ob__ 属性指向一个Observer 实例，
   * 这个实例上实际上还保存着一个dep，也就是obj.__ob__.dep
   */

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set

  let childOb = !shallow && observe(val)
  /**
   * val = obj[key]，递归调用 observe(val)，
   * 如果val 是对象数组则正常设置val.__ob__ 等等，
   * 如果是普通类型则直接返回。
   * childOb 接受到的值就是这个Observer 实例，也就是val.__ob__，
   * 结合defineReactive 函数开头那段注释，
   * 我们可以知道，对于一个Object 对象来说，会有两个dep 实例被该对象getter, setter 闭包调用，
   * 一个是defineReactive 函数第一句新建的const dep = new Dep()，
   * 还有一个就是这个对象childOb.dep 也就是__ob__.dep
   * 
   * obj.__ob__.dep 这个Dep 实例的用处在于调用this.$set 向对象上添加响应式属性时发布更新。
   */
  Object.defineProperty(obj, key, {
    /**
     * 转为访问器属性，设置getter, setter
     */
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      /**
       * 如果原来就有getter 函数，则先执行，保证取值正确
       */
      if (Dep.target) {
        /**
         * Dep.target 是一个唯一全局变量，指向当前观测中的Watcher 实例
         */
        dep.depend()
        /**
         * 收集依赖
         */
        if (childOb) {
          childOb.dep.depend()
          /**
           * 两个dep 里收集的依赖是相同的。
           */
          if (Array.isArray(value)) {
            dependArray(value)
            /**
             * 对于Array 来说，如果渲染Watcher使用了这个Array，那么不仅这个Array的dep 要收集依赖，
             * Array 下的Object 和Array 也都应该收集这个依赖，因为改变这个Array 下的Object 或Array 也
             * 属于改变了这个Array，也应该发布更新才对。
             * dependArray 就是完成这个需求的，dependArray 函数中，遍历获得Array 的值e，
             * 然后执行e && e.__ob__ && e.__ob__.dep.depend() 收集依赖，
             * 最后判断e 是否又是一个Array，如果是则递归调用dependArray
             */
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      /**
       * 这里更新了childOb 是因为set 有可能设置了一个Object 或Array，
       * 此时这个数据是未观测的，必须执行一次observe。
       */
      dep.notify()
      /**
       * 发布更新。
       */
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (hasOwn(target, key)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
