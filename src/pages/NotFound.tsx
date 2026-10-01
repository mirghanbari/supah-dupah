import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="plate mx-auto grid max-w-xl place-items-center gap-4 p-10 text-center">
      <div className="font-slab text-8xl text-sauce">404</div>
      <p className="font-slab text-xl">Whatever you were lookin' for, we're all out.</p>
      <p className="text-sm text-ink-soft">It might've fallen off a truck. It might never have existed. We don't ask.</p>
      <Link to="/" className="btn btn-red">
        Back to markets
      </Link>
    </div>
  );
}
