import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import NewProjectView from '../../src/views/NewProjectView.vue';
import router from '../../src/router';
import { saveProject } from '../../src/helper/indexeddb';
import { projectService } from '../../src/services/ProjectService';

// Mocked services
vi.mock('@/helper/indexeddb', () => ({
  saveProject: vi.fn(),
}));

vi.mock('@/services/ProjectService');

describe('NewProjectView', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.onLine to simulate online status
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    wrapper = mount(NewProjectView, {
      global: {
        stubs: {
          NewProjectForm: false, // Disable the child component mock
        },
      },
    });
  });

  afterEach(() => {
    // Restore the original navigator.onLine value after tests
    delete (window.navigator as any).onLine;
  });

  it('renders NewProjectView properly', () => {
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the input field for project title', () => {
    const input = wrapper.find('input#value');
    expect(input.exists()).toBe(true);
  });

  it('handles input value changes correctly', async () => {
    const input = wrapper.find('input#value');
    expect(input.exists()).toBe(true);

    // Set input value and check binding with v-model
    await input.setValue('New Project Title');
    expect(input.element.getAttribute('value')).toBe('New Project Title');
  });

  it('displays an error message when project title exceeds max length', async () => {
    const input = wrapper.find('input#value');
    expect(input.exists()).toBe(true);

    const longTitle = 'A'.repeat(101);
    await input.setValue(longTitle);

    const errorMessage = wrapper.find('small.p-error');
    expect(errorMessage.exists()).toBe(true);
    expect(errorMessage.text()).toContain('darf nicht mehr als 100 Zeichen lang sein');
  });

  it('handles the abort function and navigates to ProjectSelection', async () => {
    const mockRouterPush = vi.spyOn(router, 'push').mockResolvedValue();

    const abortButton = wrapper.find('button[type="reset"]');
    expect(abortButton.exists()).toBe(true);

    await abortButton.trigger('click');

    // Ensure navigation to ProjectSelection
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'ProjectSelection' });
  });

  it('saves the project to IndexedDB when offline', async () => {
    // Mock `navigator.onLine` to simulate offline status
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false, // Set to offline
    });

    const input = wrapper.find('input#value');
    await input.setValue('Offline Project');

    const form = wrapper.find('form');
    await form.trigger('submit');

    // Verify that saveProject was called with the project title
    expect(saveProject).toHaveBeenCalledWith('Offline Project');
  });

  it('sends the project to the backend and updates the store when online', async () => {
    // Ensure navigator is online
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    const mockRouterPush = vi.spyOn(router, 'push').mockResolvedValue();
    vi.mocked(projectService.createProject).mockResolvedValue({ id: '1', title: 'Test Project' });

    const input = wrapper.find('input#value');
    await input.setValue('Online Project');

    const form = wrapper.find('form');
    await form.trigger('submit');

    // Ensure that the API call was made and the router push was triggered
    expect(projectService.createProject).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'ProjectDashboard',
      params: { projectId: '1' },
    });
  });

  it('handles error and saves project title offline if the API call fails', async () => {
    // Simulate an error in project creation
    const errorMessage = 'Network error';
    vi.mocked(projectService.createProject).mockReturnValue(
      Promise.reject(new Error(errorMessage)),
    );

    // Ensure navigator is online
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const input = wrapper.find('input#value');
    await input.setValue('Error Project');

    const form = wrapper.find('form');
    await form.trigger('submit');

    // Verify that the project title is saved offline due to the error
    expect(saveProject).toHaveBeenCalledWith('Error Project');
  });
});
