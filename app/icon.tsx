import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e7fff6",
          borderRadius: 7,
          border: "2px solid #a2f5d4"
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: "#050505",
            boxShadow: "-3px 0 0 #25f4ee, 3px 0 0 #fe2c55"
          }}
        />
      </div>
    ),
    size
  );
}
