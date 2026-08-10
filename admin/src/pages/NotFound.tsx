import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <p className="mb-4 text-muted-foreground">Page not found</p>
        <Link to="/" className="text-sm text-primary underline hover:text-primary/90">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
