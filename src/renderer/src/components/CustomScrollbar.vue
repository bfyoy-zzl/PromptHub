<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 'auto'
})

const contentRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const thumbRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isHovering = ref(false)
const isScrolling = ref(false)
const startY = ref(0)
const startScrollTop = ref(0)
let scrollTimeout: NodeJS.Timeout | null = null
let hoverTimeout: NodeJS.Timeout | null = null

const updateThumb = () => {
  if (!contentRef.value || !thumbRef.value || !trackRef.value) return
  
  const content = contentRef.value
  const thumb = thumbRef.value
  const track = trackRef.value
  
  // 检查内容是否超过一屏
  const needsScrollbar = content.scrollHeight > content.clientHeight
  
  if (!needsScrollbar) {
    track.style.display = 'none'
    return
  }
  
  track.style.display = 'block'
  
  const scrollRatio = content.scrollTop / (content.scrollHeight - content.clientHeight)
  const thumbHeight = Math.max(30, (content.clientHeight / content.scrollHeight) * content.clientHeight)
  
  thumb.style.height = `${thumbHeight}px`
  thumb.style.top = `${scrollRatio * (content.clientHeight - thumbHeight)}px`
  
  // 滚动时显示滚动条
  showScrollbar()
}

const showScrollbar = () => {
  if (!trackRef.value) return
  trackRef.value.style.opacity = '1'
  isScrolling.value = true
  
  // 清除之前的定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  
  // 2秒后隐藏滚动条
  scrollTimeout = setTimeout(() => {
    if (!isHovering.value && !isDragging.value) {
      hideScrollbar()
    }
    isScrolling.value = false
  }, 2000)
}

const hideScrollbar = () => {
  if (!trackRef.value) return
  trackRef.value.style.opacity = '0'
}

const handleThumbDrag = (e: MouseEvent) => {
  if (!isDragging.value || !contentRef.value || !thumbRef.value) return
  
  e.preventDefault()
  const content = contentRef.value
  const thumb = thumbRef.value
  const track = trackRef.value
  
  if (!track) return
  
  const deltaY = e.clientY - startY.value
  const trackHeight = track.clientHeight
  const thumbHeight = thumb.clientHeight
  const maxScroll = content.scrollHeight - content.clientHeight
  
  const scrollDelta = (deltaY / (trackHeight - thumbHeight)) * maxScroll
  content.scrollTop = Math.min(Math.max(0, startScrollTop.value + scrollDelta), maxScroll)
}

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  startY.value = e.clientY
  startScrollTop.value = contentRef.value?.scrollTop || 0
  document.addEventListener('mousemove', handleThumbDrag)
  document.addEventListener('mouseup', stopDrag)
  showScrollbar()
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleThumbDrag)
  document.removeEventListener('mouseup', stopDrag)
  if (!isScrolling.value && !isHovering.value) {
    setTimeout(() => hideScrollbar(), 2000)
  }
}

const handleTrackClick = (e: MouseEvent) => {
  if (!contentRef.value || !thumbRef.value || e.target === thumbRef.value) return
  
  const content = contentRef.value
  const thumb = thumbRef.value
  const track = trackRef.value
  
  if (!track) return
  
  const rect = track.getBoundingClientRect()
  const clickY = e.clientY - rect.top
  const thumbHeight = thumb.clientHeight
  const maxScroll = content.scrollHeight - content.clientHeight
  
  const scrollRatio = clickY / (track.clientHeight - thumbHeight)
  content.scrollTop = Math.min(Math.max(0, scrollRatio * maxScroll), maxScroll)
}

const handleTrackMouseEnter = () => {
  isHovering.value = true
  showScrollbar()
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
  }
}

const handleTrackMouseLeave = () => {
  isHovering.value = false
  if (!isScrolling.value && !isDragging.value) {
    hoverTimeout = setTimeout(() => hideScrollbar(), 2000)
  }
}

onMounted(() => {
  if (contentRef.value) {
    contentRef.value.addEventListener('scroll', updateThumb)
    // 延迟更新以确保内容已渲染
    setTimeout(updateThumb, 100)
  }
  
  if (trackRef.value) {
    trackRef.value.addEventListener('mouseenter', handleTrackMouseEnter)
    trackRef.value.addEventListener('mouseleave', handleTrackMouseLeave)
  }
})

onUnmounted(() => {
  if (contentRef.value) {
    contentRef.value.removeEventListener('scroll', updateThumb)
  }
  if (trackRef.value) {
    trackRef.value.removeEventListener('mouseenter', handleTrackMouseEnter)
    trackRef.value.removeEventListener('mouseleave', handleTrackMouseLeave)
  }
  document.removeEventListener('mousemove', handleThumbDrag)
  document.removeEventListener('mouseup', stopDrag)
  
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
  }
})
</script>

<template>
  <div class="custom-scrollbar" :style="{ height }">
    <div ref="contentRef" class="custom-scrollbar-content">
      <slot></slot>
    </div>
    <div 
      ref="trackRef" 
      class="custom-scrollbar-track" 
      @click="handleTrackClick"
      style="opacity: 0; transition: opacity 0.3s ease-in-out;"
    >
      <div 
        ref="thumbRef" 
        class="custom-scrollbar-thumb" 
        @mousedown="startDrag"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: auto;
  max-height: 100%;
}

.custom-scrollbar-content {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  height: auto;
  max-height: 100%;
  width: 100%;
  padding-right: 20px;
  box-sizing: border-box;
}

.custom-scrollbar-track {
  position: absolute;
  top: 0;
  right: 5px;
  width: 8px;
  height: 100%;
  background: transparent;
  z-index: 10;
  pointer-events: auto;
}

.custom-scrollbar-thumb {
  position: absolute;
  right: 0;
  width: 8px;
  background-color: var(--text-sub);
  border-radius: 4px;
  opacity: 0.8;
  cursor: pointer;
  transition: background-color 0.2s;
  pointer-events: auto;
}

.custom-scrollbar-thumb:hover {
  opacity: 1;
}

/* 毛玻璃主题滚动条 */
html[data-theme='glass'] .custom-scrollbar-track {
  width: 6px;
}

html[data-theme='glass'] .custom-scrollbar-thumb {
  width: 6px;
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

html[data-theme='glass'] .custom-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.6);
}

html.dark[data-theme='glass'] .custom-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.2);
}

html.dark[data-theme='glass'] .custom-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.5);
}

/* 新拟物主题滚动条 */
html[data-theme='neu'] .custom-scrollbar-track {
  width: 10px;
}

html[data-theme='neu'] .custom-scrollbar-thumb {
  width: 10px;
  background-color: var(--bg-panel);
  border-radius: 10px;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light), inset 1px 1px 2px rgba(255, 255, 255, 0.3);
  border: none;
  opacity: 1;
}

html[data-theme='neu'] .custom-scrollbar-thumb:hover {
  box-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light), inset 1px 1px 2px rgba(255, 255, 255, 0.4);
}

html.dark[data-theme='neu'] .custom-scrollbar-thumb {
  background-color: var(--bg-panel);
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light), inset 1px 1px 2px rgba(255, 255, 255, 0.1);
}

html.dark[data-theme='neu'] .custom-scrollbar-thumb:hover {
  box-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light), inset 1px 1px 2px rgba(255, 255, 255, 0.2);
}

/* 简约主题滚动条 */
html[data-theme='modern'] .custom-scrollbar-thumb {
  background-color: var(--text-sub);
  border-radius: 4px;
  opacity: 0.6;
}

html[data-theme='modern'] .custom-scrollbar-thumb:hover {
  background-color: var(--text-main);
  opacity: 0.8;
}

html.dark[data-theme='modern'] .custom-scrollbar-thumb {
  background-color: var(--text-sub);
  opacity: 0.7;
}

html.dark[data-theme='modern'] .custom-scrollbar-thumb:hover {
  background-color: var(--text-main);
  opacity: 0.9;
}
</style>