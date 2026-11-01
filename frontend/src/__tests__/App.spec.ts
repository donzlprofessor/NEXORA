import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../App.vue'

describe('App', () => {
  it('renders the workspace shell and routed content', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<p>Dashboard content</p>' } }],
    })
    await router.push('/')
    await router.isReady()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    const wrapper = mount(App, { global: { plugins: [router, createPinia()] } })
    expect(wrapper.text()).toContain('NEXORA')
    expect(wrapper.text()).toContain('Dashboard content')
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
