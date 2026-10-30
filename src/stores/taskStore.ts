import { create } from "zustand";
import api from "@/lib/api";
import { syncServerTime } from "@/lib/serverTime";

export interface Task {
  id: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  /** Extra (INR) the poster added for a fast pickup. */
  urgencyBonus?: number;
  location: string;
  distance: string;
  time: string;
  date: string;
  rating: number;
  imageUrl?: string;
  status: "open" | "in_progress" | "completed" | "expired";
  posterId: string;
  posterName: string;
  posterAvatar?: string;
  posterRating: number;
  workerId?: string;
  workerName?: string;
  workerMarkedDone?: boolean;
  /** End of the search window (ISO). Null/absent = no timer. */
  expiresAt?: string | null;
  createdAt: string;
}

interface TaskState {
  tasks: Task[];
  myPostedTasks: Task[];
  myWorkedTasks: Task[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  fetchTasks: (filters?: TaskFilters, page?: number) => Promise<void>;
  fetchMyPostedTasks: () => Promise<Task[]>;
  fetchMyWorkedTasks: () => Promise<Task[]>;
  addTask: (task: { title: string; category: string; description: string; budget: number; location?: string; time: string; date: string; imageUrl?: string; searchMinutes?: number; urgencyBonus?: number }) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  getTaskById: (id: string) => Task | undefined;
  filterTasks: (filters: TaskFilters) => Task[];
}

export interface TaskFilters {
  search?: string;
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  maxDistance?: number;
  minRating?: number;
  sortBy?: "date" | "budget_high" | "budget_low" | "distance";
}

let latestTasksRequest = 0;

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  myPostedTasks: [],
  myWorkedTasks: [],
  isLoading: false,
  error: null,
  hasMore: false,
  page: 1,

  fetchTasks: async (filters?: TaskFilters, page = 1) => {
    const requestId = ++latestTasksRequest;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (filters?.search) params.set("search", filters.search);
      if (filters?.category && filters.category !== "All") params.set("category", filters.category);
      if (filters?.minBudget) params.set("minBudget", String(filters.minBudget));
      if (filters?.maxBudget) params.set("maxBudget", String(filters.maxBudget));
      if (filters?.sortBy) params.set("sortBy", filters.sortBy);

      const res = await api.get(`/tasks?${params.toString()}`);
      syncServerTime(res.data?.serverNow);
      const rawTasks = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      // Normalize: ensure every task has an `id` (backend may return `_id`)
      const taskList = rawTasks.map((t: any) => ({
        ...t,
        id: t.id ?? t._id?.toString?.(),
      }));
      // Ignore responses that arrive after a newer request was made.
      if (requestId !== latestTasksRequest) return;
      set((state) => ({
        // Later pages append (skipping anything already shown); page 1 replaces.
        tasks:
          page > 1
            ? [...state.tasks, ...taskList.filter((t: Task) => !state.tasks.some((x) => x.id === t.id))]
            : taskList,
        hasMore: !!res.data?.hasMore,
        page,
        isLoading: false,
      }));
    } catch {
      if (requestId !== latestTasksRequest) return;
      set({ tasks: [], isLoading: false, error: "We couldn't load tasks. Check your connection and try again." });
    }
  },

  fetchMyPostedTasks: async () => {
    try {
      const res = await api.get("/tasks/posted");
      const rawTasks = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      const list = rawTasks.map((t: any) => ({
        ...t,
        id: t.id ?? t._id?.toString?.(),
      }));
      set({ myPostedTasks: list });
      return list;
    } catch (err) {
      console.error("Failed to fetch my posted tasks", err);
      return [];
    }
  },

  fetchMyWorkedTasks: async () => {
    try {
      const res = await api.get("/tasks/worked");
      const rawTasks = Array.isArray(res.data?.tasks) ? res.data.tasks : [];
      const list = rawTasks.map((t: any) => ({
        ...t,
        id: t.id ?? t._id?.toString?.(),
      }));
      set({ myWorkedTasks: list });
      return list;
    } catch (err) {
      console.error("Failed to fetch my worked tasks", err);
      return [];
    }
  },

  addTask: async (taskData) => {
    try {
      const res = await api.post("/tasks", taskData);
      const rawTask = res.data?.task;
      if (!rawTask) {
        throw new Error("Task creation did not return a task");
      }
      const newTask = {
        ...rawTask,
        id: rawTask.id ?? rawTask._id?.toString?.(),
      };
      set((state) => ({ tasks: [newTask, ...state.tasks] }));
      return newTask;
    } catch (err) {
      console.error("Failed to create task", err);
      throw err;
    }
  },

  updateTask: async (id, data) => {
    try {
      const res = await api.patch(`/tasks/${id}`, data);
      const rawTask = res.data?.task;
      if (!rawTask) {
        throw new Error("Task update did not return a task");
      }
      const updatedTask = {
        ...rawTask,
        id: rawTask.id ?? rawTask._id?.toString?.(),
      };
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t)),
      }));
      return updatedTask;
    } catch (err) {
      console.error("Failed to update task", err);
      throw err;
    }
  },

  deleteTask: async (id) => {
    await api.delete(`/tasks/${id}`);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      myPostedTasks: state.myPostedTasks.filter((t) => t.id !== id),
    }));
  },

  getTaskById: (id: string) => {
    return get().tasks.find((t) => t.id === id);
  },

  filterTasks: (filters: TaskFilters) => {
    let filtered = [...get().tasks];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    if (filters.category && filters.category !== "All") {
      filtered = filtered.filter((t) => t.category === filters.category);
    }

    if (filters.minBudget !== undefined) {
      filtered = filtered.filter((t) => t.budget >= filters.minBudget!);
    }
    if (filters.maxBudget !== undefined) {
      filtered = filtered.filter((t) => t.budget <= filters.maxBudget!);
    }

    if (filters.maxDistance !== undefined) {
      filtered = filtered.filter((t) => parseFloat(t.distance) <= filters.maxDistance!);
    }

    if (filters.minRating !== undefined) {
      filtered = filtered.filter((t) => t.rating >= filters.minRating!);
    }

    if (filters.sortBy) {
      switch (filters.sortBy) {
        case "budget_high":
          filtered.sort((a, b) => b.budget - a.budget);
          break;
        case "budget_low":
          filtered.sort((a, b) => a.budget - b.budget);
          break;
        case "date":
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        case "distance":
          filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
          break;
      }
    }

    return filtered;
  },
}));