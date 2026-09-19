{
  description = "Slopfarm, a WebGPU resource collection game";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";
    git-hooks = {
      url = "https://flakehub.com/f/cachix/git-hooks.nix/0.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {nixpkgs, ...}: let
    systems = ["x86_64-linux" "aarch64-linux"];
    forAllSystems = nixpkgs.lib.genAttrs systems;
  in {
    packages = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      source = pkgs.lib.cleanSourceWith {
        src = ./.;
        filter = path: _: let
          name = baseNameOf path;
        in
          !builtins.elem name [".direnv" "dist" "node_modules" "result"];
      };
      pnpmDeps = pkgs.fetchPnpmDeps {
        pname = "slopfarm";
        version = "0.1.0";
        src = source;
        pnpm = pkgs.pnpm_10;
        fetcherVersion = 3;
        hash = "sha256-jjVohaMIgwIWHnFzbouCKiC5cIhTNlueJn9Gdufk2Z8=";
      };
    in {
      default = pkgs.stdenvNoCC.mkDerivation {
        pname = "slopfarm";
        version = "0.1.0";
        src = source;
        inherit pnpmDeps;
        nativeBuildInputs = [pkgs.nodejs_24 pkgs.pnpm_10 pkgs.pnpmConfigHook];
        buildPhase = "pnpm build";
        installPhase = "cp -r dist $out";
      };
    });

    checks = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      package = inputs.self.packages.${system}.default;
      preCommitCheck = inputs.git-hooks.lib.${system}.run {
        package = pkgs.prek;
        src = ./.;
        hooks = {
          alejandra.enable = true;
          deadnix.enable = true;
          statix.enable = true;
          prettier = {
            enable = true;
            types_or = ["javascript" "ts" "css" "html" "json" "markdown"];
          };
        };
      };
      mkPnpmCheck = name: command:
        package.overrideAttrs (_: {
          pname = "slopfarm-${name}";
          buildPhase = command;
          installPhase = "touch $out";
        });
    in {
      build = package;
      lint = mkPnpmCheck "lint" "pnpm lint";
      test = mkPnpmCheck "test" "pnpm test";
      format = mkPnpmCheck "format" "pnpm format:check";
      assets = import ./scripts/blender/check.nix {
        inherit pkgs;
        src = inputs.self;
      };
      pre-commit = preCommitCheck;
    });

    formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.alejandra);

    devShells = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
      preCommitCheck = inputs.self.checks.${system}.pre-commit;
    in {
      default = pkgs.mkShell {
        packages = [pkgs.nodejs_24 pkgs.pnpm_10 pkgs.jq] ++ preCommitCheck.enabledPackages;
        inherit (preCommitCheck) shellHook;
      };
      assets = pkgs.mkShell {
        packages = [pkgs.blender pkgs.imagemagick];
      };
    });
  };
}
