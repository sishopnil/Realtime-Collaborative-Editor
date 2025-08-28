"use client";
import React from 'react';

type Props = { children: React.ReactNode; fallback?: React.ReactNode };

type State = { hasError: boolean };

export class EditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('Editor crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div role="alert">Editor failed to load.</div>;
    }
    return this.props.children;
  }
}

