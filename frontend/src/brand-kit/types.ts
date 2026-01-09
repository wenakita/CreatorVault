import React from 'react';

export enum AssetType {
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  IDEA = 'IDEA'
}

export interface VaultAsset {
  id: string;
  title: string;
  type: AssetType;
  content: string; // URL for image, Text content for text
  createdAt: number;
  tags: string[];
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}