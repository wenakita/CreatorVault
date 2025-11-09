import { useNavigate } from "react-router-dom";
import Header from "../layout/Header";

const HomePage = () => {
  const navigate = useNavigate();

  const handleClickTraditional = () => {
    navigate("/traditional");
  };
  const handleClickAgent = () => {
    navigate("/agent");
  };
  return (
    <div className="w-full h-screen overflow-auto hide-scrollbar bg-[#0A0A0A] text-white">
      <Header
        agentAddress=""
        agentBalance={0}
        handleAgent={async () => {}}
        handleSendToAgent={async (to: string) => {}}
        isLoading={false}
        issend={false}
      />
      <div className="w-full flex justify-center items-center pt-20">
        <div className="flex flex-col justify-center items-center gap-4 min-w-[20rem] h-full">
          <h1 className="w-full text-4xl text-blue-500 font-semibold text-center">
            Select...
          </h1>
          <hr className="w-full sm:px-4" />
          <div className="flex sm:flex-col sm:gap-y-4 flex-row w-full p-4 justify-center items-center gap-x-8">
            <button
              onClick={handleClickTraditional}
              className="bg-green-700 text-lg font-semibold text-white px-4 py-2 rounded-md hover:bg-green-500 transition-colors w-full"
            >
              Traditional
            </button>
            <button
              onClick={handleClickAgent}
              className="bg-cyan-700  text-lg font-semibold text-white px-4 py-2 rounded-md hover:bg-cyan-500 transition-colors w-full"
            >
              Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
