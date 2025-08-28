import { render, screen } from '@testing-library/react';
import Editor from '../../components/Editor';

describe('Editor component', () => {
  it('renders toolbar buttons with aria-labels', () => {
    render(<Editor value={{ type: 'html', content: '<p>Hello</p>' }} />);
    expect(screen.getByRole('toolbar', { name: /editor toolbar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
  });

  it('renders large content without crashing', () => {
    const paras = Array.from({ length: 200 }, (_, i) => `<p>Para ${i} ${'x'.repeat(100)}</p>`).join('');
    render(<Editor value={{ type: 'html', content: paras }} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
