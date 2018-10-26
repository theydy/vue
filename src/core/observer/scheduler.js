/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      /**
       * flushing 是否正在更新的标志
       */
      queue.push(watcher)
      /**
       * 多个不同的观测对象可能收集同一个Watcher 实例，
       * 所以就造成了同一个Watcher 实例可能在一次事件循环中被多次调用update 方法，
       * 这里的has[id] 就是为了过滤相同的Watcher ，
       * 最后添加到queue 中的Watcher 实例都是不同的，
       * 这些操作都是为了提高Vue 的性能。
       */
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
      /**
       * 走这段逻辑的典型：计算属性(computed)
       * 如果queue 正在执行更新操作，则通过index 和id 寻找这个Watcher 实例应该插入的位置，
       * index 是queue 当前正在执行更新watcher 的下标，是个全局变量，
       * queue 在执行更新前会按照watcher.id 排序，
       * 所以跳出while 循环有两个可能
       * 一、i <= index 说明当前插入进来的watcher 的id 很小，但是queue 需要按照watcher id
       * 从小到大顺序执行，所以虽然会把当前wather 插入到queue 中，但是这个watcher 要在下一个
       * 更新中才会执行。
       * 二、queue[i].id <= watcher.id ，此时插入queue 中的watcher ，index 还没有执行到这个位置，
       * 所以这个watcher 会在这个更新中执行。
       */
    }
    // queue the flush
    if (!waiting) {
      /**
       * 在每次更新周期中，这段代码只会执行一次，主要功能相当于定了个计时器预约执行更新操作，
       * 下次更新周期开始是，会执行resetSchedulerState 函数，
       * 在resetSchedulerState 函数中会把has, queue, index, fleshing, waiting 等置回初值。
       */
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
      /**
       * nextTick 将flushSchedulerQueue 函数加到微任务队列
       * (前提是浏览器支持promise，如果不支持promise 则
       * 通过setImmediate, MessageChannel, setTimeout 加入到宏任务)，
       * 所以一般来说一次事件循环最多执行一次更新操作。
       * flushSchedulerQueue
       * queue 中的watcher 在这个函数中执行更新
       */
    }
  }
}
