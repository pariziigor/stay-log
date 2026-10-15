import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { OwnerDashboard } from '../components/dashboard/OwnerDashboard';
import { EmployeeDashboard } from '../components/dashboard/EmployeeDashboard';

export const DashboardPage: React.FC = () => {
  const { role } = useAuth();

  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'employee':
      return <EmployeeDashboard />;
    case 'owner':
    default:
      return <OwnerDashboard />;
  }
};
