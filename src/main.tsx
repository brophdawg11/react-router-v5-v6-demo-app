import React, { useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";
import { __RouterContext as RouterContextV5 } from "react-router";
import {
  Switch,
  Route as RouteV5,
  Router as RouterV5,
  useHistory,
  useLocation as useLocationV5,
  useParams as useParamsV5,
} from "react-router-dom";
import {
  CompatRoute,
  Link as LinkV6,
  Routes,
  Route as RouteV6,
  RouterProvider,
  Outlet,
  createBrowserRouter,
  useLocation as useLocationV6,
  useParams as useParamsV6,
  useNavigate,
  unstable_Blocker as BlockerV6,
  unstable_BlockerFunction as BlockerFunctionV6
} from "react-router-dom-v5-compat";

// Create a source-of-truth data router
// - Anything at the root will be v6 only and support loaders/actions/etc.
// - Anything inside the splat will funnel down in a V5/CompatRoute app and
//   can be migrated incrementally to V6 APIs. Once a route is fully on v6,
//   lift the definition up to here to access data APIs
const router = createBrowserRouter([
  {
    path: "/v6",
    element: <V6App />,
    children: [
      {
        path: ":param",
        element: <V6Child />,
      },
    ],
  },
  {
    path: "*",
    element: <UniversalRouter />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// Proxy our data router state to a v5 sub-tree via a v5-shaped history
function UniversalRouter() {
  let state = useSyncExternalStore(router.subscribe, () => router.state);
  let stubHistory = React.useMemo(
    () => ({
      action: router.state.historyAction,
      location: router.state.location,
      createHref: router.createHref,
      push(to) {
        router.navigate(to);
      },
      replace(to) {
        router.navigate(to, { replace: true });
      },
      block(shouldProceed: any) {
        let blocker: Partial<BlockerV6> = {};
        const blockerKey = crypto.randomUUID();

        const v6BlockerFn: BlockerFunctionV6 = ({
          nextLocation,
          historyAction,
        }) => {
          return !shouldProceed(nextLocation, historyAction);
        };

        blocker = router.getBlocker(blockerKey, v6BlockerFn);

        return () => {
          blocker.proceed?.();
          blocker.reset?.();
          router.deleteBlocker(blockerKey);
        };
      },
      listen: () => {},
      // length
      // go
      // goBack
      // goForward
    }),
    [router, state]
  );

  return (
    <RouterContextV5.Provider
      value={{
        history: stubHistory,
        location: router.state.location,
        match: RouterV5.computeRootMatch(router.state.location.pathname),
        staticContext: undefined,
      }}
    >
      <App />
    </RouterContextV5.Provider>
  );
}

function Nav() {
  return (
    <nav>
      <ul>
        <li>
          <LinkV6 to="/">Home</LinkV6>
        </li>
        <li>
          <LinkV6 to="/a">/a</LinkV6>
        </li>
        <li>
          <LinkV6 to="/a/blocker">/a/blocker</LinkV6>
        </li>
        <li>
          <LinkV6 to="/a/one">/a/one</LinkV6>
        </li>
        <li>
          <LinkV6 to="/v6">/v6</LinkV6>
        </li>
        <li>
          <LinkV6 to="/v6/child">/v6/child</LinkV6>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  return (
    <div>
      <Nav />
      {/*
        Render an embedded v5 app
         - <CompatRoute> sub-trees have access to v6 APIs
         - <RouteV5> sub-trees do not
      */}
      <Switch>
        <CompatRoute path="/a">
          <A />
        </CompatRoute>
        <RouteV5 path="/">
          <Home />
        </RouteV5>
      </Switch>
    </div>
  );
}

function Home() {
  console.log(useLocationV5());
  console.log(useLocationV6());
  return <h2>Home</h2>;
}

function A() {
  let locationV5 = useLocationV5();
  let locationV6 = useLocationV6();

  return (
    <>
      <h2>A</h2>
      <p>useLocation v5: {locationV5.pathname}</p>
      <p>useLocation v6: {locationV6.pathname}</p>

      <div style={{ border: "1px solid grey", padding: "10px" }}>
        <p>Rendered sub-tree using v6 &lt;Routes&gt;</p>
        <Routes>
          <RouteV6 path=":param" element={<AParam />} />
        </Routes>
      </div>

      <div style={{ border: "1px solid grey", padding: "10px" }}>
        <p>Rendered sub-tree using v5 &lt;Switch&gt;</p>
        <Switch>
          <RouteV5 path="/a/blocker">
            <BlockerComponent />
          </RouteV5>
          <RouteV5 path="/a/:param">
            <AParam />
          </RouteV5>
        </Switch>
      </div>
    </>
  );
}

function AParam() {
  let paramsV5 = useParamsV5();
  let paramsV6 = useParamsV6();
  let historyV5 = useHistory();
  let navigateV6 = useNavigate();

  return (
    <>
      <h3>A Param</h3>
      <p>useParams v5 value: {JSON.stringify(paramsV5)}</p>
      <p>useParams v6 value: {JSON.stringify(paramsV6)}</p>
      <button onClick={() => historyV5.push("/a")}>Go to /a (v5)</button>
      <button onClick={() => navigateV6("/a")}>Go to /a (v6)</button>
    </>
  );
}

function V6App() {
  let location = useLocationV6();

  return (
    <>
      <Nav />
      <h2>This route can only use v6 APIs</h2>
      <p>Location v6: {location.pathname}</p>
      <Outlet />
    </>
  );
}

function V6Child() {
  let paramsV6 = useParamsV6();
  let navigate = useNavigate();
  return (
    <>
      <h3>V6 Child</h3>
      <p>Params: {JSON.stringify(paramsV6)}</p>
      <button onClick={() => navigate("/")}>Go to /</button>
    </>
  );
}

function BlockerComponent() {
  let history = useHistory();
  let [text, setText] = React.useState('');

  console.log(history);

  React.useEffect(() => {
    // I think the signature of the blocker function may have changed in later verions
    // 5.1.2 passes posisional arguments, but latest v5 docs show an object passed to the blocker fn
    let unblock = history.block(nextLocation => {
      if (!text) {
        unblock();
        return true;
      }

      // Navigation was blocked! Let's show a confirmation dialog
      // so the user can decide if they actually want to navigate
      // away and discard changes they've made in the current page.
      let url = nextLocation.pathname;
      if (window.confirm(`Are you sure you want to go to ${url}?`)) {
        // Unblock the navigation.
        unblock();
        return true;

        // Retry the transition.
        // tx.retry();
      }

      // false should block
      return false;
    });

    return unblock;
  }, [history, text]);

  return (
    <input type="text" onChange={e => setText(e.target.value)} value={text} />
  )
}
