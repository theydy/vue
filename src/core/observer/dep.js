/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    /**
     * 每个Dep 实例都有的唯一id
     */
    this.subs = []
    /**
     * subs 列表存放收集到的Watcher 实例。
     */
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
      /**
       * 调用当前Watcher 实例的addDep() 方法。
       * addDep 方法里会判断是否重复收集依赖，最后还是调用Dep 的addSub 把当前Watcher 实例添加到队列中。
       */
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
      /**
       * 调用Watcher 实例的update() 方法更新。
       */
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null
const targetStack = []

export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
  /**
   * 如果Dep.target 已经指向一个Watcher 实例时，会暂时把这个Watcher 实例压到栈里，
   * 在修改Dep.target 指向当前Watcher 实例。
   */
}

export function popTarget () {
  Dep.target = targetStack.pop()
}
