import { ref, computed, type Ref } from 'vue'

export function useHistory<T>(state: Ref<T>) {
  const past = ref<string[]>([])
  const future = ref<string[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const serialize = (val: T): string => JSON.stringify(val)
  const deserialize = (str: string): T => JSON.parse(str)

  // 核心：在操作“之前”保存当前快照
  const commit = () => {
    const current = serialize(state.value)
    const last = past.value[past.value.length - 1]

    // 只有在数据确实发生了变化（与最近的历史记录不同）时才入栈
    if (current !== last) {
      past.value.push(current)
      // 一旦有了新动作，清空重做栈
      future.value = []
      if (past.value.length > 50) past.value.shift()
    }
  }

  const undo = () => {
    if (!canUndo.value) return

    // 将当前状态推入 future 供 redo 使用
    const current = serialize(state.value)
    future.value.unshift(current)

    // 弹出上一条记录
    const previous = past.value.pop()!
    state.value = deserialize(previous)
  }

  const redo = () => {
    if (!canRedo.value) return

    // 将当前状态回推入 past
    const current = serialize(state.value)
    past.value.push(current)

    // 弹出下一条记录
    const next = future.value.shift()!
    state.value = deserialize(next)
  }

  const clear = (initialState?: T) => {
    past.value = []
    future.value = []
    // 如果提供了初始状态，将其作为历史的第一条底座
    if (initialState !== undefined) {
      // past.value.push(serialize(initialState))
      // 注意：初始状态不该进 past，否则第一次撤销会退回到这个点。
      // 我们在外部组件逻辑里手动控制 commit。
    }
  }

  return {
    canUndo,
    canRedo,
    commit,
    undo,
    redo,
    clear
  }
}
