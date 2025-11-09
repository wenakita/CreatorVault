import { useEffect } from "react";
import Header from "../layout/Header";
import { useNavigate } from "react-router-dom";
import { useUserWallets, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
// import toast, { Toaster } from "react-hot-toast";
const Agent = () => {
  const navigate = useNavigate();
  // const logIn = useIsLoggedIn();
  useEffect(() => {
    // if (!logIn) {
    //   navigate("/");
    // }
  }, []);

  return (
    <div className="w-full h-screen overflow-auto hide-scrollbar bg-[#0A0A0A] text-white">
      {/* <Toaster /> */}

      <Header
        // agentAddress=""
        // agentBalance={0}
        handleAgent={async () => {}}
        handleSendToAgent={async (to: string) => {}}
        isLoading={false}
        issend={false}
      />
    </div>
  );
};

export default Agent;
