import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Home Page', () => {
  it('renders title', () => {
    render(<Page />);
    expect(screen.getByText('Realtime Collaborative Editor')).toBeInTheDocument();
  });
});

