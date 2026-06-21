import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
export function NotFoundPage() { return <EmptyState title="Page not found" description="The requested page does not exist." action={<Link className="button primary" to="/">Return to Dashboard</Link>} />; }
