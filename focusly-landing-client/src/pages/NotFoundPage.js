import { Link } from 'react-router-dom';



const NotFoundPage = () => {
    return (
        <div className="not-found-page">
            <h1>404</h1>
            <h2>Oops! Page not found.</h2>
            <p>
                The page you are looking for does not exist or has been moved.
            </p>
            <Link to="/" className="not-found-btn">
                Go to Homepage
            </Link>
        </div>
    );
};

            export default NotFoundPage;