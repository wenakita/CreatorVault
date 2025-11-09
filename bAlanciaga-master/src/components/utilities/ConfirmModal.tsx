import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";
import utils, { changeBorder, changeColors } from "../../utils/setting";
import Loader from "./Loader";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  poolAddress: string;
  chain: number;
  CreateVault: (poolAddress: string) => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  poolAddress,
  CreateVault,
  chain,
}) => {
  useEffect(() => {
    console.log("ConfirmModal open:", open);
  }, []);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-100">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
        <div className="flex items-center justify-center min-h-screen px-4">
          <div className="bg-[#111111] w-full max-w-md rounded-2xl border border-gray-800/30 shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <Dialog.Title className={`text-md ${changeColors[chain]} font-medium`}>
                    Create Vault
                  </Dialog.Title>
                </div>
                <div className="text-white">
                  {utils.truncateMiddle(poolAddress)}
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-[#1B1B1B] transition-colors"
                >
                  <X className="h-6 w-6 text-gray-400" />
                </button>
              </div>
              <div
                className="flex gap-4 cursor-pointer"
                onClick={async () => {
                  console.log("Confirming...", poolAddress);
                  setIsLoading(true);
                  await CreateVault(poolAddress);
                  setIsLoading(false);
                  onClose();
                }}
              >
                <button
                  className={`${changeBorder[chain]} hover:text-white cursor-pointer mx-auto p-2 border-[1px] border-white rounded-lg w-full ${changeColors[chain]} ${
                    isLoading && "bg-blue-500/90 text-white hover:bg-blue-500"
                  }`}
                >
                  {isLoading ? <Loader /> : "Create Valut"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ConfirmModal;
