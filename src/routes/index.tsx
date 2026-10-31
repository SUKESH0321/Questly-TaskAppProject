import { createBrowserRouter } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import { ProtectedRoute, GuestRoute } from "@/components/auth/ProtectedRoute";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import RoleSelection from "@/pages/auth/RoleSelection";
import TaskerOnboarding from "@/pages/auth/TaskerOnboarding";
import VerifyPhone from "@/pages/auth/VerifyPhone";

import CreateTask from "@/pages/tasks/CreateTask";
import TaskSuccess from "@/pages/tasks/Success";
import BrowseTasks from "@/pages/tasks/BrowseTasks";
import TaskDetails from "@/pages/tasks/TaskDetails";
import Home from "@/pages/Home";
import ProfilePage from "@/pages/profile/ProfilePage";
import PublicProfilePage from "@/pages/profile/PublicProfilePage";
import SettingsPage from "@/pages/settings/SettingsPage";
import MessagesPage from "@/pages/messages/MessagesPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import AdminPage from "@/pages/admin/AdminPage";
import NotFound from "@/pages/NotFound";
import RouteError from "@/pages/RouteError";

export const router = createBrowserRouter(
  [
  {
    path: "/",
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <GuestRoute>
            <Login />
          </GuestRoute>
        ),
      },
      {
        path: "login",
        element: (
          <GuestRoute>
            <Login />
          </GuestRoute>
        ),
      },
      {
        path: "register",
        element: (
          <GuestRoute>
            <Register />
          </GuestRoute>
        ),
      },
      {
        path: "verify-phone",
        element: (
          <ProtectedRoute allowNoRole allowUnverifiedPhone>
            <VerifyPhone />
          </ProtectedRoute>
        ),
      },
      {
        path: "role-selection",
        element: (
          <ProtectedRoute allowNoRole>
            <RoleSelection />
          </ProtectedRoute>
        ),
      },
      {
        path: "onboarding",
        element: (
          <ProtectedRoute allowNoRole>
            <TaskerOnboarding />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteError />,
    children: [
      { path: "/home", element: <Home /> },
      { path: "/tasks", element: <BrowseTasks /> },
      { path: "/tasks/create", element: <CreateTask /> },
      { path: "/tasks/success", element: <TaskSuccess /> },
      { path: "/tasks/:id", element: <TaskDetails /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/profile/:id", element: <PublicProfilePage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/messages", element: <MessagesPage /> },
      { path: "/notifications", element: <NotificationsPage /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute adminOnly>
        <AdminPage />
      </ProtectedRoute>
    ),
    errorElement: <RouteError />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
  ],
  // Vite's base ("/QuestlyTaskApp/") without the trailing slash; "" when served from the root.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || undefined },
);
